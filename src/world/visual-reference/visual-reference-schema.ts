export type VisualReferenceCategory =
  | "composition"
  | "readability"
  | "color"
  | "density"
  | "object_shape"
  | "world_consistency"
  | "copyright_safety";

export type VisualReferenceAllowedUse = "abstract_principle_only";

export type VisualReferenceGuideline = {
  id: string;
  category: VisualReferenceCategory;
  principle: string;
  allowedUse: VisualReferenceAllowedUse;
  forbiddenUse: string[];
  enforcementTags: string[];
};

export type VisualStyleSafetyPolicy = {
  id: string;
  forbidsDirectCopy: true;
  forbidsNamedArtistImitation: true;
  forbidsIPReplication: true;
  forbidsReferenceImageReconstruction: true;
  allowsGenericPixelArtPrinciples: true;
  allowsRealWorldObservation: true;
  requiresTransformativeOriginalExpression: true;
  forbiddenIntentTags: string[];
  requiredOutputTags: string[];
  sourceAttributionPolicy: string;
  tags: string[];
};
