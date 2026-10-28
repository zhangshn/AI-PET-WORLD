"""092 retry fixtures and exact091 computational AST comparison; no model load."""
import ast, copy, errno, hashlib, json, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).absolute().parents[1]/'scripts'))
import painter_replay_retention_review_recovery_v1 as recovery


class Clock:
    def __init__(self):self.value=0;self.sleeps=[]
    def now(self):return self.value
    def sleep(self,seconds):self.sleeps.append(seconds);self.value+=seconds


def audit():return {'reads':0,'retries':0,'events':[],'overflow':False,'maximumReadElapsedMs':0}


class DynamicReadTests(unittest.TestCase):
    def run_read(self,read,clock=None,budget=lambda:None,record=None):
        clock=clock or Clock();record=record if record is not None else audit()
        value=recovery.read_dynamic_json(None,logical_path='.runtime/private/heartbeat.json',audit=record,budget_check=budget,read_bytes=read,clock=clock.now,sleep=clock.sleep)
        return value,clock,record

    def test_permission_then_success_saves_every_failed_attempt_and_success(self):
        calls=[]
        def read():
            calls.append(1)
            if len(calls)<3:raise PermissionError(errno.EACCES,'busy')
            return b'{"runId":"bound"}'
        value,clock,record=self.run_read(read)
        self.assertEqual(value,{'runId':'bound'});self.assertEqual(len(calls),3)
        self.assertEqual(record['reads'],1);self.assertEqual(record['retries'],2)
        self.assertEqual([v['attempt'] for v in record['events']],[1,2,3])
        self.assertEqual([v['errno'] for v in record['events']],[13,13,None])
        self.assertEqual(record['events'][-1]['outcome'],'succeeded_after_retry')
        self.assertAlmostEqual(clock.value,.075)
        self.assertTrue(all(v['path']=='.runtime/private/heartbeat.json' for v in record['events']))

    def test_eperm_and_exact_windows_sharing_errors_are_transient(self):
        for error in (PermissionError(errno.EPERM,'permission'),OSError(errno.EBUSY,'sharing')):
            if not isinstance(error,PermissionError):error.winerror=32
            calls=[]
            def read():
                calls.append(1)
                if len(calls)==1:raise error
                return b'{}'
            self.assertEqual(self.run_read(read)[0],{});self.assertEqual(len(calls),2)

    def test_permanent_permission_error_stops_at_five_attempts(self):
        clock=Clock();record=audit();calls=[]
        def read():calls.append(1);raise PermissionError(errno.EACCES,'busy')
        with self.assertRaises(PermissionError):self.run_read(read,clock,record=record)
        self.assertEqual(len(calls),5);self.assertEqual(record['retries'],4);self.assertEqual(len(record['events']),5)
        self.assertAlmostEqual(clock.value,.325);self.assertEqual(record['events'][-1]['outcome'],'failed')
        self.assertAlmostEqual(record['maximumReadElapsedMs'],325)

    def test_os_call_overrun_is_detected_without_claiming_hard_os_timeout(self):
        clock=Clock();record=audit();calls=[]
        def read():calls.append(1);clock.value+=.6;return b'{}'
        with self.assertRaises(TimeoutError):self.run_read(read,clock,record=record)
        self.assertEqual(len(calls),1);self.assertEqual(record['events'][-1]['outcome'],'elapsed_limit')
        self.assertGreater(record['events'][-1]['elapsedMs'],500)

    def test_missing_other_io_and_malformed_json_are_never_retried(self):
        for error in (FileNotFoundError(errno.ENOENT,'absent'),OSError(errno.EIO,'io'),OSError(errno.EBUSY,'busy')):
            calls=[]
            def read():calls.append(1);raise error
            with self.assertRaises(OSError):self.run_read(read)
            self.assertEqual(len(calls),1)
        calls=[]
        def invalid():calls.append(1);return b'{' if len(calls)==1 else b'{}'
        with self.assertRaises(json.JSONDecodeError):self.run_read(invalid)
        self.assertEqual(len(calls),1)

    def test_retry_then_malformed_content_does_not_resume_reading(self):
        calls=[];record=audit()
        def read():
            calls.append(1)
            if len(calls)==1:raise PermissionError(errno.EACCES,'busy')
            return b'{' if len(calls)==2 else b'{}'
        with self.assertRaises(json.JSONDecodeError):self.run_read(read,record=record)
        self.assertEqual(len(calls),2);self.assertEqual(record['events'][-1]['outcome'],'content_invalid_no_retry')

    def test_600_900_budget_callback_is_checked_during_waits(self):
        clock=Clock();record=audit();calls=[]
        def read():calls.append(1);raise PermissionError(errno.EACCES,'busy')
        def budget():
            if clock.value>=.05:raise RuntimeError('original worker or total deadline')
        with self.assertRaisesRegex(RuntimeError,'original worker'):self.run_read(read,clock,budget,record)
        self.assertEqual(len(calls),2);self.assertAlmostEqual(clock.value,.075)
        self.assertEqual(record['retries'],1);self.assertEqual(record['readAttempts'],2)

    def test_stale_identity_or_sha_validation_after_read_does_not_retry(self):
        calls=[]
        def read():calls.append(1);return b'{"identity":"wrong","sha256":"wrong","heartbeatAtUtc":"old"}'
        value,_,_=self.run_read(read)
        with self.assertRaises(ValueError):recovery.require(value['identity']=='expected','identity differs')
        with self.assertRaises(ValueError):recovery.require(value['sha256']=='expected','SHA differs')
        with self.assertRaises(ValueError):recovery.require(value['heartbeatAtUtc']=='fresh','stale')
        self.assertEqual(len(calls),1)


class FrozenMathTests(unittest.TestCase):
    def test_original_pure_validation_and_all_forward_math_loops_are_identical_AST(self):
        script_dir=Path(__file__).absolute().parents[1]/'scripts'
        old=ast.parse((script_dir/'painter_replay_retention_review_v1.py').read_text(encoding='utf-8'))
        new=ast.parse((script_dir/'painter_replay_retention_review_recovery_v1.py').read_text(encoding='utf-8'))
        functions=lambda tree:{n.name:n for n in tree.body if isinstance(n,ast.FunctionDef)}
        a,b=functions(old),functions(new)
        for name in ('validate_members','validate_lease','validate_checkpoint_metadata','validate_histories','validate_metric_numbers','tensor_state_hash','encode_json','publish_input_manifests'):
            self.assertEqual(ast.dump(a[name]),ast.dump(b[name]),name)
        old_loops=[n for n in ast.walk(a['execute']) if isinstance(n,ast.For) and 'sample_forward' in ast.unparse(n)]
        new_loops=[n for n in ast.walk(b['execute']) if isinstance(n,ast.For) and 'sample_forward' in ast.unparse(n)]
        self.assertEqual([ast.dump(n) for n in old_loops],[ast.dump(n) for n in new_loops])

    def test_dynamic_retry_is_used_only_for_the_three_named_control_reads(self):
        source=(Path(__file__).absolute().parents[1]/'scripts'/'painter_replay_retention_review_recovery_v1.py').read_text(encoding='utf-8')
        tree=ast.parse(source);execute=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='execute')
        dynamic=[ast.unparse(n) for n in ast.walk(execute) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='dynamic']
        self.assertEqual(len(dynamic),3)
        self.assertTrue(any('worker-lease.json' in s for s in dynamic));self.assertTrue(any('current-execution-registry/current.json' in s for s in dynamic));self.assertTrue(any('heartbeat.json' in s for s in dynamic))
        self.assertNotIn('while not lease_path.exists()',source)


class RecoveryEvidenceTests(unittest.TestCase):
    def test_exact_published_policy_and_zero_call_failure_bindings(self):
        root=Path(__file__).absolute().parents[3]
        p=json.loads((root/'data/ai-painter/system-governance/ai-painter-replay-retention-review-recovery-policy-v1.json').read_bytes())
        def read(binding):
            raw=(root/binding['path']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(),binding['sha256'])
            return json.loads(raw)
        failure,prior,failed,streams=[read(p[k]) for k in ('priorFailure','priorPackage','inferenceFailure','workerStreams')]
        pkg=dict(policy=p['baseReviewPolicy'],sourceTerminal=p['trainingSource']['terminal'],sourcePackage=p['trainingSource']['package'],sourceCheckpoint=p['trainingSource']['checkpoint'],resources=p['resources'])
        recovery.validate_recovery_evidence(p,pkg,failure,prior,failed,streams)
        with self.assertRaises(ValueError):recovery.validate_recovery_evidence(p,pkg,failure,prior,{**failed,'actualCalls':{**failed['actualCalls'],'generatorForwards':1}},streams)
        with self.assertRaises(ValueError):recovery.validate_recovery_evidence(p,pkg,{**failure,'cleanupError':'not resolved'},prior,failed,streams)
        with self.assertRaises(ValueError):recovery.validate_recovery_evidence(p,pkg,failure,prior,failed,{**streams,'stderr':'different failure'})


if __name__=='__main__':unittest.main()
