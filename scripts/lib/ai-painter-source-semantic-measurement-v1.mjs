// Diagnostic geometry only. No filesystem, image recognition, threshold, training or release authority.
import { createHash } from 'node:crypto';
const hash = b => createHash('sha256').update(b).digest('hex');
const EPS = 1e-9; // Numerical intersection precision, NOT a semantic acceptance tolerance.
function requireThat(ok, code) { if (!ok) throw new Error(code); }
function bound(binding) {
  requireThat(Buffer.isBuffer(binding?.bytes) && binding.bytes.length <= 16 * 1024 * 1024, 'INVALID_OR_OVERSIZED_BYTES');
  requireThat(/^[a-f0-9]{64}$/.test(binding.sha256 ?? '') && hash(binding.bytes) === binding.sha256, 'BYTE_BINDING_MISMATCH');
  return binding.bytes;
}
function point(p, w, h) {
  requireThat(p && Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h, 'POINT_OUT_OF_FRAME');
  return p;
}
function cross(a, b) { return a.x * b.y - a.y * b.x; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function polygon(points, w, h) {
  requireThat(Array.isArray(points) && points.length >= 3 && points.length <= 256, 'POLYGON_SIZE_INVALID');
  points.forEach(p => point(p, w, h));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    requireThat(Math.hypot(a.x - b.x, a.y - b.y) > EPS, 'POLYGON_DUPLICATE_VERTEX');
    area += cross(a, b);
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      const orient = (p, q, r) => cross(sub(q, p), sub(r, p));
      const overlap = Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)) <= Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) + EPS
        && Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) <= Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)) + EPS;
      requireThat(!(overlap && orient(a,b,c)*orient(a,b,d) <= EPS && orient(c,d,a)*orient(c,d,b) <= EPS), 'POLYGON_SELF_INTERSECTION');
    }
  }
  requireThat(Math.abs(area) > EPS, 'POLYGON_DEGENERATE');
  return points;
}
function inside(p, poly) {
  let value = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) value=!value;
  }
  return value;
}
function intervals(poly, origin, normal) {
  const hits=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i], edge=sub(poly[(i+1)%poly.length],a), offset=sub(a,origin), denominator=cross(normal,edge);
    if(Math.abs(denominator)<=EPS) {
      if(Math.abs(cross(offset,normal))<=EPS) return null; // Collinear boundary: no invented width.
      continue;
    }
    const t=cross(offset,edge)/denominator,u=cross(offset,normal)/denominator;
    if(u>=-EPS && u<=1+EPS) hits.push(t);
  }
  const sorted=hits.sort((a,b)=>a-b).filter((t,i,a)=>i===0||Math.abs(t-a[i-1])>EPS), result=[];
  for(let i=0;i+1<sorted.length;i++) {
    const mid=(sorted[i]+sorted[i+1])/2;
    if(inside({x:origin.x+mid*normal.x,y:origin.y+mid*normal.y},poly)) result.push([sorted[i],sorted[i+1]]);
  }
  return result;
}

/** Caller supplies actual task/RGB/annotation bytes and pinned identities.
 * Hash matching proves byte consistency only, never source authority or annotation truth.
 * Annotation polygon/contact is an observation, not extracted or certified by this module.
 */
export function measureSourceSemantics({ task, image, observation } = {}) {
  const result={schemaVersion:'ai-painter-source-semantic-measurement-v1',status:'unresolved',trainingEligible:false,
    semanticQualification:false,observationTruthVerified:false,measurements:[],issues:[]};
  try {
    const taskBytes=bound(task); bound(image);
    const t=JSON.parse(taskBytes), {width:w,height:h}=t.outputSize ?? {};
    requireThat(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=4096&&h<=4096,'INVALID_TASK_FRAME');
    requireThat(typeof t.taskId==='string' && Array.isArray(t.spatialLayers?.objectFootprints),'INVALID_TASK');
    result.bindings={taskSha256:task.sha256,imageSha256:image.sha256};
    if(!observation) { result.issues.push('INDEPENDENT_OBSERVATION_MISSING'); return result; }
    const o=JSON.parse(bound(observation)); result.bindings.observationSha256=observation.sha256;
    requireThat(o.schemaVersion==='ai-painter-source-observation-draft-v1','OBSERVATION_SCHEMA_INVALID');
    requireThat(o.taskId===t.taskId && o.taskSha256===task.sha256 && o.imageSha256===image.sha256,'OBSERVATION_IDENTITY_MISMATCH');
    requireThat(o.frame?.width===w && o.frame?.height===h && o.frame?.coordinates==='native_xy','OBSERVATION_FRAME_MISMATCH');
    requireThat(typeof o.actor==='string' && o.actor.length>0 && o.actor.length<=200 && typeof o.method==='string' && o.method.length>0,'OBSERVATION_PROVENANCE_MISSING');
    result.provenance={actor:o.actor,method:o.method,interpretation:'caller_recorded_unverified_observation'};
    requireThat(Array.isArray(o.objects)&&o.objects.length<=128,'OBJECT_OBSERVATIONS_INVALID');
    const seen=new Set();
    for(const obj of o.objects) {
      requireThat(!seen.has(obj.objectId),'DUPLICATE_OBJECT_OBSERVATION'); seen.add(obj.objectId);
      const expected=t.spatialLayers.objectFootprints.filter(e=>e.objectId===obj.objectId);
      requireThat(expected.length===1,'OBJECT_IDENTITY_MISMATCH');
      const e=expected[0], b=e.footprint;
      requireThat(b&&Number.isFinite(b.width)&&Number.isFinite(b.height)&&b.width>0&&b.height>0,'INVALID_FOOTPRINT');
      point(b,w,h);point({x:b.x+b.width,y:b.y+b.height},w,h);
      requireThat(['observed','unknown','occluded'].includes(obj.state),'OBJECT_STATE_INVALID');
      const row={kind:'object',objectId:obj.objectId,expectedClass:e.kind,state:obj.state};
      if(obj.state==='observed') {
        requireThat(typeof obj.observedClass==='string' && obj.observedClass.length>0,'OBSERVED_CLASS_MISSING');
        row.observedClass=obj.observedClass;row.classMatchesStatement=obj.observedClass===e.kind;
        if(obj.groundContact) {
          requireThat(obj.contactKind==='ground_contact','CANOPY_IS_NOT_GROUND_CONTACT');
          const p=point(obj.groundContact,w,h);
          row.contactInsideClosedFootprint=p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height;
          row.distanceToClosedFootprintPixels=Math.hypot(Math.max(b.x-p.x,0,p.x-b.x-b.width),Math.max(b.y-p.y,0,p.y-b.y-b.height));
        } else row.contactState='unobserved';
      }
      result.measurements.push(row);
    }
    if(o.road) {
      requireThat(Array.isArray(o.road.sections)&&o.road.sections.length>0&&o.road.sections.length<=32,'ROAD_SECTIONS_INVALID');
      const roads=t.spatialLayers.terrainRegions?.filter(r=>r.kind==='path_ground') ?? [];
      requireThat(roads.length===1,'MULTI_ROAD_GEOMETRY_UNSUPPORTED');
      const expected=polygon(roads[0].polygon,w,h), observed=polygon(o.road.polygon,w,h);
      for(const section of o.road.sections) {
        const origin=point(section.origin,w,h), tangent=section.tangent;
        requireThat(tangent&&Number.isFinite(tangent.x)&&Number.isFinite(tangent.y),'INVALID_TANGENT');
        const length=Math.hypot(tangent.x,tangent.y);requireThat(length>EPS,'INVALID_TANGENT');
        const normal={x:-tangent.y/length,y:tangent.x/length};
        const a=intervals(expected,origin,normal),b=intervals(observed,origin,normal);
        const row={kind:'road_cross_section',origin,normal,tangentProvenance:'caller_selected_not_automatically_centerline_verified'};
        if(a?.length!==1||b?.length!==1) row.state='ambiguous_or_missing_intersection';
        else { row.state='measured';row.expectedWidthPixels=a[0][1]-a[0][0];row.observedWidthPixels=b[0][1]-b[0][0];row.widthDeltaPixels=row.observedWidthPixels-row.expectedWidthPixels;row.signedBoundaryOffsetsPixels=[b[0][0]-a[0][0],b[0][1]-a[0][1]]; }
        result.measurements.push(row);
      }
    }
    result.status='diagnostic_only';
    result.issues.push('OBSERVATION_TRUTH_NOT_VERIFIED','NO_SEMANTIC_ACCEPTANCE_THRESHOLD_APPLIED');
  } catch(error) { result.status='invalid_input'; result.measurements=[]; result.issues.push(error.message); }
  return result;
}
