// A recorder failure cannot change or retry an already durable Git operation.
// The production caller supplies only the fixed work-producers facade, never browser input.
export async function publishAndRecord(service,input,recordGitOperation) {
  const result=service.publish(input)
  let workRecording
  try {
    const binding=service.operationBinding(result.operation.operationId)
    workRecording=binding?await recordGitOperation(binding):{recorded:false,replayed:false,eventIds:[],reasonCode:'git_operation_not_terminal'}
  } catch {
    workRecording={recorded:false,replayed:false,eventIds:[],reasonCode:'git_work_recording_unavailable'}
  }
  return{...result,workRecording}
}
