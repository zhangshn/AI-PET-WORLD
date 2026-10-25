export type DocumentMeta={documentId:string;relativePath:string;category:string;title:string;version:string|null;authorityStatus:string|null;programAdoptionStatus:string|null;historical:boolean;restricted:boolean;bytes:number|null;sha256:string|null;metadataRevision:string|null;availability:string;reasonCode?:string}
export type DocumentBody=DocumentMeta&{content:string}
export type DiagramMeta={diagramId:string;documentId:string;title:string;type:'mermaid'|'text';section:string;startLine:number;endLine:number;sourceDocumentSha256:string;relativePath:string;authorityStatus:string|null;programAdoptionStatus:string|null;historical:boolean}
export type DiagramBody=DiagramMeta&{source:string}
export type CatalogPage<T>={records:T[];knownRecordCount:number;revision:string;nextCursor:string|null;previousCursor:string|null;registeredCount?:number;categories?:string[];links?:{documentId:string;relativePath:string}[]}
export type PageValues=Record<string,string|undefined>
