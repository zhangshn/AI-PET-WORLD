import type { ConditionChannelId } from "./ai-painter-lab-data"

type ConditionPreviewProps = {
  channel: ConditionChannelId
  color: string
}

export function ConditionPreview({ channel, color }: ConditionPreviewProps) {
  return (
    <svg viewBox="0 0 256 192" role="img" aria-label={`${channel} 条件图预览`}>
      <rect width="256" height="192" fill="#101a18" />
      {channel === "grass" && <path d="M0 0H220V192H0Z" fill={color} />}
      {(channel === "water" || channel === "water_body") && <path d="M218 0H256V192H224L216 142L226 92L214 48Z" fill={color} />}
      {channel === "shoreline" && <path d="M210 0H226L222 48L233 92L222 143L230 192H214L206 143L216 92L205 48Z" fill={color} />}
      {(channel === "road" || channel === "road_center") && <path d="M18 190C54 158 70 140 112 119S162 88 178 54" fill="none" stroke={color} strokeWidth="15" />}
      {channel === "road_edge" && <path d="M18 190C54 158 70 140 112 119S162 88 178 54" fill="none" stroke={color} strokeWidth="25" opacity=".75" />}
      {(channel === "tree" || channel === "tree_crown") && <><circle cx="32" cy="36" r="20" fill={color} /><circle cx="194" cy="34" r="27" fill={color} /><circle cx="48" cy="151" r="23" fill={color} /></>}
      {channel === "tree_trunk" && <><rect x="28" y="50" width="8" height="12" fill={color} /><rect x="189" y="56" width="10" height="14" fill={color} /><rect x="44" y="170" width="8" height="12" fill={color} /></>}
      {channel === "rock" && <><ellipse cx="88" cy="42" rx="16" ry="11" fill={color} /><ellipse cx="188" cy="122" rx="13" ry="9" fill={color} /><ellipse cx="53" cy="105" rx="9" ry="7" fill={color} /></>}
      {channel === "shelter" && <rect x="102" y="88" width="54" height="40" fill={color} />}
      {channel === "shelter_foundation" && <rect x="98" y="126" width="62" height="10" fill={color} />}
      {channel === "shelter_wall" && <rect x="102" y="96" width="54" height="32" fill={color} />}
      {channel === "shelter_roof" && <path d="M102 88L129 67L156 88Z" fill={color} />}
      {channel === "construction_material" && <><rect x="164" y="132" width="18" height="10" fill={color} /><rect x="186" y="136" width="11" height="13" fill={color} /></>}
      {channel === "walkable" && <path d="M8 10H208V182H8Z M84 70H178V144H84Z" fill={color} fillRule="evenodd" />}
      {channel === "depth" && <><rect x="0" y="0" width="256" height="48" fill={color} opacity=".25" /><rect x="0" y="48" width="256" height="48" fill={color} opacity=".45" /><rect x="0" y="96" width="256" height="48" fill={color} opacity=".65" /><rect x="0" y="144" width="256" height="48" fill={color} opacity=".9" /></>}
    </svg>
  )
}

export function BlueprintPreview() {
  return (
    <svg viewBox="0 0 256 192" role="img" aria-label="Blueprint 结构预览">
      <rect width="256" height="192" fill="#8db66c" />
      <path d="M218 0H256V192H224L216 142L226 92L214 48Z" fill="#4b91a2" />
      <path d="M18 190C54 158 70 140 112 119S162 88 178 54" fill="none" stroke="#d2aa66" strokeWidth="15" />
      <g fill="#36714a" stroke="#214b38" strokeWidth="3"><circle cx="32" cy="36" r="20" /><circle cx="194" cy="34" r="27" /><circle cx="48" cy="151" r="23" /></g>
      <g fill="#a9aca6" stroke="#6f746f" strokeWidth="3"><ellipse cx="88" cy="42" rx="16" ry="11" /><ellipse cx="188" cy="122" rx="13" ry="9" /><ellipse cx="53" cy="105" rx="9" ry="7" /></g>
      <rect x="102" y="88" width="54" height="40" fill="#b87945" stroke="#72452e" strokeWidth="4" />
      <path d="M102 88L129 67L156 88" fill="#d79b58" stroke="#72452e" strokeWidth="4" />
      <g fill="#fff"><circle cx="129" cy="108" r="3" /><circle cx="178" cy="54" r="3" /></g>
    </svg>
  )
}
