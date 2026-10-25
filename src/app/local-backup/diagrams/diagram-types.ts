import type { DiagramMeta, DiagramBody, CatalogPage, DocumentMeta } from '../documents/document-types'
export type ArchitectureDiagram=DiagramMeta&{documentTitle:string;documentVersion:string|null;level:string;module:string;sourceFormat:string;sourceLanguage:string;designStatus:string;implementationEvidenceStatus:string}
export type ArchitectureBody=ArchitectureDiagram&DiagramBody
export type CatalogGroup={id:string;label:string;count:number}
export type ArchitecturePage=CatalogPage<ArchitectureDiagram>&{levels:CatalogGroup[];modules:CatalogGroup[];sourceCount:number;coverage:{scope:string;existingSources:{relativePath:string;version:string|null;count:number}[];textDefinitionsWithoutDiagram:{topic:string;section:string;module:string;document:DocumentMeta}[];missingDesignDefinitions:{topic:string;reason:string;module:string;documentId:string;section:string}[]}}
