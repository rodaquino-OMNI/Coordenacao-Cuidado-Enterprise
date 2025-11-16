/**
 * FHIR Gateway Types
 * Extended types for FHIR operations
 */

export interface FHIROperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    details?: {
      text: string;
    };
    diagnostics?: string;
  }>;
}

export interface FHIRCapabilityStatement {
  resourceType: 'CapabilityStatement';
  status: 'draft' | 'active' | 'retired' | 'unknown';
  date: string;
  kind: 'instance' | 'capability' | 'requirements';
  software?: {
    name: string;
    version?: string;
  };
  fhirVersion: string;
  format: string[];
  rest?: Array<{
    mode: 'client' | 'server';
    resource?: Array<{
      type: string;
      interaction?: Array<{
        code: string;
      }>;
      searchParam?: Array<{
        name: string;
        type: string;
        documentation?: string;
      }>;
    }>;
  }>;
}

export interface FHIRBatchRequest {
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
  };
  resource?: any;
}

export interface FHIRBatchResponse {
  response: {
    status: string;
    location?: string;
    etag?: string;
    lastModified?: string;
  };
  resource?: any;
}

export interface FHIRSearchParameters {
  _id?: string;
  _lastUpdated?: string;
  _tag?: string;
  _profile?: string;
  _security?: string;
  _text?: string;
  _content?: string;
  _list?: string;
  _has?: string;
  _type?: string;
  _sort?: string;
  _count?: number;
  _include?: string;
  _revinclude?: string;
  _summary?: 'true' | 'false' | 'text' | 'data' | 'count';
  _elements?: string;
  _contained?: 'true' | 'false' | 'both';
  [key: string]: any;
}

export interface FHIRValidationResult {
  valid: boolean;
  issues: Array<{
    severity: 'error' | 'warning' | 'information';
    message: string;
    location?: string;
  }>;
}

export interface FHIRPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export type FHIRPatch = FHIRPatchOperation[];
