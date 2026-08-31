// Generated Ajv standalone validators. Do not edit by hand.
// The source schema is frontend compatibility material, not a canonical backend contract.
"use strict";
export const run = validate10;
const schema11 = {
  title: "RunReportContract",
  type: "object",
  required: ["report_kind", "contract_version", "summary"],
  properties: {
    report_kind: { const: "wind_tunnel_run_result" },
    contract_version: { const: "wind_tunnel.run.v1alpha1" },
    status: { type: "string" },
    summary: {
      type: "object",
      required: ["trace_name", "range_label"],
      properties: {
        trace_name: { type: "string" },
        range_label: { type: "string" },
        end_to_end_latency_us: { type: "number" },
        runtime_event_count: { type: "integer", minimum: 0 },
        fabric_record_count: { type: "integer", minimum: 0 },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.run.v1",
};
function validate10(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.run.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.report_kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_kind" },
        message: "must have required property '" + "report_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.contract_version === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_version" },
        message: "must have required property '" + "contract_version" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.summary === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "summary" },
        message: "must have required property '" + "summary" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.report_kind !== undefined) {
      if ("wind_tunnel_run_result" !== data.report_kind) {
        const err3 = {
          instancePath: instancePath + "/report_kind",
          schemaPath: "#/properties/report_kind/const",
          keyword: "const",
          params: { allowedValue: "wind_tunnel_run_result" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if ("wind_tunnel.run.v1alpha1" !== data.contract_version) {
        const err4 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/const",
          keyword: "const",
          params: { allowedValue: "wind_tunnel.run.v1alpha1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      if (typeof data.status !== "string") {
        const err5 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.summary !== undefined) {
      let data3 = data.summary;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.trace_name === undefined) {
          const err6 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/required",
            keyword: "required",
            params: { missingProperty: "trace_name" },
            message: "must have required property '" + "trace_name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data3.range_label === undefined) {
          const err7 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/required",
            keyword: "required",
            params: { missingProperty: "range_label" },
            message: "must have required property '" + "range_label" + "'",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data3.trace_name !== undefined) {
          if (typeof data3.trace_name !== "string") {
            const err8 = {
              instancePath: instancePath + "/summary/trace_name",
              schemaPath: "#/properties/summary/properties/trace_name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data3.range_label !== undefined) {
          if (typeof data3.range_label !== "string") {
            const err9 = {
              instancePath: instancePath + "/summary/range_label",
              schemaPath: "#/properties/summary/properties/range_label/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        if (data3.end_to_end_latency_us !== undefined) {
          if (!(typeof data3.end_to_end_latency_us == "number")) {
            const err10 = {
              instancePath: instancePath + "/summary/end_to_end_latency_us",
              schemaPath: "#/properties/summary/properties/end_to_end_latency_us/type",
              keyword: "type",
              params: { type: "number" },
              message: "must be number",
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        if (data3.runtime_event_count !== undefined) {
          let data7 = data3.runtime_event_count;
          if (!(typeof data7 == "number" && !(data7 % 1) && !isNaN(data7))) {
            const err11 = {
              instancePath: instancePath + "/summary/runtime_event_count",
              schemaPath: "#/properties/summary/properties/runtime_event_count/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
          if (typeof data7 == "number") {
            if (data7 < 0 || isNaN(data7)) {
              const err12 = {
                instancePath: instancePath + "/summary/runtime_event_count",
                schemaPath: "#/properties/summary/properties/runtime_event_count/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
          }
        }
        if (data3.fabric_record_count !== undefined) {
          let data8 = data3.fabric_record_count;
          if (!(typeof data8 == "number" && !(data8 % 1) && !isNaN(data8))) {
            const err13 = {
              instancePath: instancePath + "/summary/fabric_record_count",
              schemaPath: "#/properties/summary/properties/fabric_record_count/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
          if (typeof data8 == "number") {
            if (data8 < 0 || isNaN(data8)) {
              const err14 = {
                instancePath: instancePath + "/summary/fabric_record_count",
                schemaPath: "#/properties/summary/properties/fabric_record_count/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
          }
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/summary",
          schemaPath: "#/properties/summary/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
  } else {
    const err16 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
  }
  validate10.errors = vErrors;
  return errors === 0;
}
export const metrics = validate11;
const schema12 = {
  title: "MetricsReportContract",
  type: "object",
  required: ["report_id", "summary"],
  properties: {
    report_id: { type: "string", pattern: "-metrics$" },
    schema_version: { type: "string" },
    contract_version: { type: "string" },
    summary: { type: "object", additionalProperties: true },
    request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.metrics.v1",
};
const pattern0 = new RegExp("-metrics$", "u");
function validate11(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.metrics.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.report_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_id" },
        message: "must have required property '" + "report_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.summary === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "summary" },
        message: "must have required property '" + "summary" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.report_id !== undefined) {
      let data0 = data.report_id;
      if (typeof data0 === "string") {
        if (!pattern0.test(data0)) {
          const err2 = {
            instancePath: instancePath + "/report_id",
            schemaPath: "#/properties/report_id/pattern",
            keyword: "pattern",
            params: { pattern: "-metrics$" },
            message: 'must match pattern "' + "-metrics$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/report_id",
          schemaPath: "#/properties/report_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if (typeof data.schema_version !== "string") {
        const err4 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if (typeof data.contract_version !== "string") {
        const err5 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.summary !== undefined) {
      let data3 = data.summary;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
      } else {
        const err6 = {
          instancePath: instancePath + "/summary",
          schemaPath: "#/properties/summary/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.request_metrics !== undefined) {
      let data4 = data.request_metrics;
      if (Array.isArray(data4)) {
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
          } else {
            const err7 = {
              instancePath: instancePath + "/request_metrics/" + i0,
              schemaPath: "#/properties/request_metrics/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/request_metrics",
          schemaPath: "#/properties/request_metrics/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate11.errors = vErrors;
  return errors === 0;
}
export const validation = validate12;
const schema13 = {
  title: "ValidationReportContract",
  type: "object",
  required: ["report_id", "validation_lane"],
  properties: {
    report_id: { type: "string", pattern: "-validation$" },
    schema_version: { type: "string" },
    contract_version: { type: "string" },
    validation_lane: { type: "string" },
    checks: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.validation.v1",
};
const pattern1 = new RegExp("-validation$", "u");
function validate12(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.validation.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.report_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_id" },
        message: "must have required property '" + "report_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.validation_lane === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validation_lane" },
        message: "must have required property '" + "validation_lane" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.report_id !== undefined) {
      let data0 = data.report_id;
      if (typeof data0 === "string") {
        if (!pattern1.test(data0)) {
          const err2 = {
            instancePath: instancePath + "/report_id",
            schemaPath: "#/properties/report_id/pattern",
            keyword: "pattern",
            params: { pattern: "-validation$" },
            message: 'must match pattern "' + "-validation$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/report_id",
          schemaPath: "#/properties/report_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if (typeof data.schema_version !== "string") {
        const err4 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if (typeof data.contract_version !== "string") {
        const err5 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.validation_lane !== undefined) {
      if (typeof data.validation_lane !== "string") {
        const err6 = {
          instancePath: instancePath + "/validation_lane",
          schemaPath: "#/properties/validation_lane/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.checks !== undefined) {
      let data4 = data.checks;
      if (Array.isArray(data4)) {
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
          } else {
            const err7 = {
              instancePath: instancePath + "/checks/" + i0,
              schemaPath: "#/properties/checks/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/checks",
          schemaPath: "#/properties/checks/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}
export const tail = validate13;
const schema14 = {
  title: "TailReportContract",
  type: "object",
  required: ["report_id"],
  properties: {
    report_id: { type: "string", pattern: "tail-cause" },
    schema_version: { type: "string" },
    contract_version: { type: "string" },
    cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.tail.v1",
};
const pattern2 = new RegExp("tail-cause", "u");
function validate13(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.tail.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.report_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_id" },
        message: "must have required property '" + "report_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.report_id !== undefined) {
      let data0 = data.report_id;
      if (typeof data0 === "string") {
        if (!pattern2.test(data0)) {
          const err1 = {
            instancePath: instancePath + "/report_id",
            schemaPath: "#/properties/report_id/pattern",
            keyword: "pattern",
            params: { pattern: "tail-cause" },
            message: 'must match pattern "' + "tail-cause" + '"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + "/report_id",
          schemaPath: "#/properties/report_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if (typeof data.schema_version !== "string") {
        const err3 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if (typeof data.contract_version !== "string") {
        const err4 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.cause_chain !== undefined) {
      let data3 = data.cause_chain;
      if (Array.isArray(data3)) {
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
          } else {
            const err5 = {
              instancePath: instancePath + "/cause_chain/" + i0,
              schemaPath: "#/properties/cause_chain/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/cause_chain",
          schemaPath: "#/properties/cause_chain/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}
export const designSpace = validate14;
const schema15 = {
  title: "DesignSpaceReportContract",
  type: "object",
  required: ["report_kind", "contract_version", "execution_scope", "ranking"],
  properties: {
    report_kind: { const: "design_space_report" },
    contract_version: { const: "design_space.report.v1alpha1" },
    execution_scope: { const: "S6_only" },
    ranking: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.designSpace.v1",
};
function validate14(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.designSpace.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.report_kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_kind" },
        message: "must have required property '" + "report_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.contract_version === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_version" },
        message: "must have required property '" + "contract_version" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.execution_scope === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "execution_scope" },
        message: "must have required property '" + "execution_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.ranking === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "ranking" },
        message: "must have required property '" + "ranking" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.report_kind !== undefined) {
      if ("design_space_report" !== data.report_kind) {
        const err4 = {
          instancePath: instancePath + "/report_kind",
          schemaPath: "#/properties/report_kind/const",
          keyword: "const",
          params: { allowedValue: "design_space_report" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if ("design_space.report.v1alpha1" !== data.contract_version) {
        const err5 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/const",
          keyword: "const",
          params: { allowedValue: "design_space.report.v1alpha1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.execution_scope !== undefined) {
      if ("S6_only" !== data.execution_scope) {
        const err6 = {
          instancePath: instancePath + "/execution_scope",
          schemaPath: "#/properties/execution_scope/const",
          keyword: "const",
          params: { allowedValue: "S6_only" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.ranking !== undefined) {
      let data3 = data.ranking;
      if (Array.isArray(data3)) {
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
          } else {
            const err7 = {
              instancePath: instancePath + "/ranking/" + i0,
              schemaPath: "#/properties/ranking/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/ranking",
          schemaPath: "#/properties/ranking/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate14.errors = vErrors;
  return errors === 0;
}
export const executionEnvelope = validate15;
const schema16 = {
  title: "ExecutionEnvelopeContract",
  type: "object",
  required: ["envelope_id", "host_path", "stages"],
  properties: {
    envelope_id: { type: "string" },
    schema_version: { type: "string" },
    contract_version: { type: "string" },
    host_path: { const: "S7" },
    stages: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  additionalProperties: true,
  $defs: {
    run: {
      title: "RunReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "summary"],
      properties: {
        report_kind: { const: "wind_tunnel_run_result" },
        contract_version: { const: "wind_tunnel.run.v1alpha1" },
        status: { type: "string" },
        summary: {
          type: "object",
          required: ["trace_name", "range_label"],
          properties: {
            trace_name: { type: "string" },
            range_label: { type: "string" },
            end_to_end_latency_us: { type: "number" },
            runtime_event_count: { type: "integer", minimum: 0 },
            fabric_record_count: { type: "integer", minimum: 0 },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    metrics: {
      title: "MetricsReportContract",
      type: "object",
      required: ["report_id", "summary"],
      properties: {
        report_id: { type: "string", pattern: "-metrics$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        summary: { type: "object", additionalProperties: true },
        request_metrics: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    validation: {
      title: "ValidationReportContract",
      type: "object",
      required: ["report_id", "validation_lane"],
      properties: {
        report_id: { type: "string", pattern: "-validation$" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        validation_lane: { type: "string" },
        checks: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    tail: {
      title: "TailReportContract",
      type: "object",
      required: ["report_id"],
      properties: {
        report_id: { type: "string", pattern: "tail-cause" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        cause_chain: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    designSpace: {
      title: "DesignSpaceReportContract",
      type: "object",
      required: ["report_kind", "contract_version", "execution_scope", "ranking"],
      properties: {
        report_kind: { const: "design_space_report" },
        contract_version: { const: "design_space.report.v1alpha1" },
        execution_scope: { const: "S6_only" },
        ranking: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
    executionEnvelope: {
      title: "ExecutionEnvelopeContract",
      type: "object",
      required: ["envelope_id", "host_path", "stages"],
      properties: {
        envelope_id: { type: "string" },
        schema_version: { type: "string" },
        contract_version: { type: "string" },
        host_path: { const: "S7" },
        stages: { type: "array", items: { type: "object", additionalProperties: true } },
      },
      additionalProperties: true,
    },
  },
  $id: "tilesim.web.compat.validator.executionEnvelope.v1",
};
function validate15(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  /*# sourceURL="tilesim.web.compat.validator.executionEnvelope.v1" */ let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.envelope_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "envelope_id" },
        message: "must have required property '" + "envelope_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.host_path === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "host_path" },
        message: "must have required property '" + "host_path" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.stages === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stages" },
        message: "must have required property '" + "stages" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.envelope_id !== undefined) {
      if (typeof data.envelope_id !== "string") {
        const err3 = {
          instancePath: instancePath + "/envelope_id",
          schemaPath: "#/properties/envelope_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if (typeof data.schema_version !== "string") {
        const err4 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.contract_version !== undefined) {
      if (typeof data.contract_version !== "string") {
        const err5 = {
          instancePath: instancePath + "/contract_version",
          schemaPath: "#/properties/contract_version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.host_path !== undefined) {
      if ("S7" !== data.host_path) {
        const err6 = {
          instancePath: instancePath + "/host_path",
          schemaPath: "#/properties/host_path/const",
          keyword: "const",
          params: { allowedValue: "S7" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.stages !== undefined) {
      let data4 = data.stages;
      if (Array.isArray(data4)) {
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
          } else {
            const err7 = {
              instancePath: instancePath + "/stages/" + i0,
              schemaPath: "#/properties/stages/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/stages",
          schemaPath: "#/properties/stages/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate15.errors = vErrors;
  return errors === 0;
}
