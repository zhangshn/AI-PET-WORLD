import type { ZiweiContentSourceReference } from "./content-detail-types"

export const ZIWEI_CONTENT_SOURCE_REFERENCE_IDS = {
  classicQuanshu: "classic.ziwei-doushu-quanshu",
  projectStarCatalog: "project.star-catalog",
  projectPatternCatalog: "project.pattern-catalog",
  projectTransformationRules: "project.transformation-rules",
  projectBrightnessTable: "project.brightness-table",
  projectDynamicFlowRules: "project.dynamic-flow-rules",
  projectContentDictionary: "project.content-dictionary",
  internalSynthesisReadingOrder: "internal.synthesis-reading-order",
  humanCalibrationNotes: "human.calibration-notes",
  modernReferenceMetadata: "external.modern-reference-metadata"
} as const

export function buildStarDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "star id, category, aliases and display metadata",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "star ontology, body meaning, reading boundary and reusable detail sections",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectBrightnessTable,
      role: "project-algorithm",
      usage: "brightness and state interpretation boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "traditional terms, star names and lineage vocabulary reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "reading order, priority boundary and synthesis downgrade rules",
      confidence: "medium"
    }
  ]
}

export function buildPatternDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern id, hit condition, category and display metadata",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "pattern explanation, formation logic, breakage boundary and reusable detail sections",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "traditional pattern vocabulary and lineage naming reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "priority, breakage review and synthesis downgrade rules",
      confidence: "medium"
    }
  ]
}

export function buildPalaceDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "palace ontology, question list, relationship usage and report boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic palace layer usage for natal, da yun, yearly, monthly, daily and hourly scopes",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "twelve palace names, traditional palace vocabulary and lineage reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "palace reading order, cross-palace boundary and synthesis downgrade rules",
      confidence: "medium"
    }
  ]
}

export function buildPalaceThemeChainSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "theme chain ontology, evidence fields, review questions and paragraph boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern hit and breakage evidence relation for theme chains",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectTransformationRules,
      role: "project-algorithm",
      usage: "si hua trigger, target star and dynamic layer evidence relation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic layer inheritance and flow palace evidence relation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "theme-chain reading order, conflict review and downgrade rules",
      confidence: "medium"
    }
  ]
}

export function buildPalaceThemeRuleSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "theme-chain template, hit rule, threshold, paragraph and evidence-field explanation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern hit, breakage, repair and evidence-domain relation context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectTransformationRules,
      role: "project-algorithm",
      usage: "si hua source stem, target star, target palace and dynamic-layer evidence context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic layer inheritance, visibility, paragraph and downgrade boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "theme-chain output order, conflict review, suppression and hidden-result rules",
      confidence: "medium"
    }
  ]
}

export function buildBranchDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "branch ontology, branch groups, palace usage and relationship boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "twelve branch names, four horse, four cardinal and four storage vocabulary reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic branch, annual branch and flow layer context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "space structure reading order and downgrade boundary",
      confidence: "medium"
    }
  ]
}

export function buildStemDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "stem ontology, palace stem usage and reading boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectTransformationRules,
      role: "project-algorithm",
      usage: "si hua trigger context and stem-to-transformation rule boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "ten stem vocabulary and traditional yin-yang element reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "stem reading order and downgrade boundary",
      confidence: "medium"
    }
  ]
}

export function buildElementGateDictionarySourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "element gate ontology, base number meaning and reading boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "da yun rhythm context and chart foundation boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.classicQuanshu,
      role: "classic-lineage",
      usage: "five element gate vocabulary and traditional foundation reference",
      confidence: "medium"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "foundation reading order and downgrade boundary",
      confidence: "medium"
    }
  ]
}

export function buildStarPalaceCombinationSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "star id, category and fixed star metadata",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "star body meaning, palace meaning and combination explanation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic layer usage for palace combination interpretation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "combination priority, downgrade and review boundary",
      confidence: "medium"
    }
  ]
}

export function buildPeriodicStarPalaceCombinationSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "periodic star id, category and display metadata",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "periodic flow layer, annual star and short-cycle boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "periodic star meaning, palace meaning and combination explanation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "periodic layer downgrade and review boundary",
      confidence: "medium"
    }
  ]
}

export function buildStarPairCombinationSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "fixed star ids and star categories for pair generation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "star body meaning and pair interaction explanation",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern participation and breakage review context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "pair priority, relationship scope and downgrade boundary",
      confidence: "medium"
    }
  ]
}

export function buildPatternCombinationRelationSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern categories, hit condition and breakage context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "star pair group and star category context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "combination relation explanation and review questions",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "formation, enhancement, breakage and weak-bearing priority rules",
      confidence: "medium"
    }
  ]
}

export function buildRelationshipStructureSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "relationship structure ontology and evidence usage",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectDynamicFlowRules,
      role: "project-algorithm",
      usage: "dynamic overlay and flow-layer relationship boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectPatternCatalog,
      role: "project-algorithm",
      usage: "pattern evidence relation and trine-square review context",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "relationship priority and conflict review boundary",
      confidence: "medium"
    }
  ]
}

export function buildTransformationTopicSourceReferences(): ZiweiContentSourceReference[] {
  return [
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectTransformationRules,
      role: "project-algorithm",
      usage: "si hua source stem, target star and flow-layer rule boundary",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectStarCatalog,
      role: "project-algorithm",
      usage: "transformation star ids and target star metadata",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.projectContentDictionary,
      role: "project-dictionary",
      usage: "si hua explanation, palace reading and evidence fields",
      confidence: "high"
    },
    {
      sourceId: ZIWEI_CONTENT_SOURCE_REFERENCE_IDS.internalSynthesisReadingOrder,
      role: "internal-synthesis",
      usage: "dynamic trigger reading order and downgrade boundary",
      confidence: "medium"
    }
  ]
}
