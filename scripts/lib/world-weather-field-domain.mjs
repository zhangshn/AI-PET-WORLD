import { baselineJson, baselineSha256 } from './natural-world-baseline-proof.mjs'
import { DAILY_FIELDS } from './natural-world-temporal-data.mjs'

const sourceDirectory = 'data/world-samples/earth-geospatial/regions/sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1/sources/nasa-power-daily-utc-domain-20261102-v1'
const metadataRef = {
  path: sourceDirectory + '/metadata.json',
  sha256: '59c7347ff0d4ed79c0cc905fe0742157ed522747b588b31a747152073bf4552d',
}
const receiptRef = {
  path: sourceDirectory + '/receipt.json',
  sha256: 'ece4fbbd8944888a3b54b25fd70ae19e2f5c6508595d07429ffc68bb2e6d3e19',
}

export function readWeatherFieldDomain(read) {
  function readBound(ref) {
    const raw = read(ref.path, 131072)
    if (baselineSha256(raw) !== ref.sha256) throw Error('weather_domain_source_changed')
    return baselineJson(raw, 131072)
  }
  const receipt = readBound(receiptRef)
  const {metadata} = readBound(metadataRef)
  const product = metadata['.zattrs']
  if (receipt.sha256 !== metadataRef.sha256 || receipt.product !== product.id ||
      product.id !== 'power_merra2_daily_temporal_utc.zarr' || receipt.version !== product.version ||
      product.time_coverage_resolution !== 'P1D' || product.time_standard !== 'Universal Time Coordinated (UTC)') {
    throw Error('weather_domain_product_mismatch')
  }
  const domainFields = Object.entries(DAILY_FIELDS).map(([field, unit]) => {
    const attrs = metadata[field + '/.zattrs']
    const expectedAggregation = field === 'PRECTOTCORR' ? 'time: sum' : 'time: mean'
    if (attrs?.status !== 'official' || attrs.units !== unit || attrs.cell_methods !== expectedAggregation ||
        !Number.isFinite(attrs.valid_min) || !Number.isFinite(attrs.valid_max) || attrs.valid_min > attrs.valid_max) {
      throw Error('weather_domain_descriptor_invalid_' + field)
    }
    const fieldId = 'environment.' + field
    return {fieldId, adapterFieldId: fieldId, dataType: 'number', unit,
      constraints: {min: attrs.valid_min, max: attrs.valid_max}, missingPolicy: 'reject',
      allowedOps: ['replace'], evidenceRefs: [{id: metadataRef.path, version: 'power-daily-utc-domain-v1', sha256: metadataRef.sha256}]}
  })
  return {product: product.id, version: product.version, metadataRef: {...metadataRef}, receiptRef: {...receiptRef}, domainFields}
}

// Inputs are four daily values in the target profile's fixed order and units.
// A missing or out-of-domain value rejects the entire candidate without modifying it.
export function checkDailyWeatherRow(domainFields, ranges, values) {
  const fields = Object.entries(DAILY_FIELDS)
  if (!Array.isArray(domainFields) || domainFields.length !== fields.length ||
      !Array.isArray(ranges) || ranges.length !== fields.length) throw Error('weather_domain_contract_shape')
  if (!Array.isArray(values) || values.length !== fields.length) {
    return {status: 'reject', reasons: ['missing_or_extra_fields'], outsideTraining: []}
  }
  const reasons = [], outsideTraining = []
  for (const [index, [field, unit]] of fields.entries()) {
    const rule = domainFields[index], range = ranges[index], value = values[index]
    if (rule?.fieldId !== 'environment.' + field || rule.unit !== unit ||
        !Number.isFinite(rule.constraints?.min) || !Number.isFinite(rule.constraints?.max) || rule.constraints.min > rule.constraints.max ||
        !Array.isArray(range) || range.length !== 2 || !Number.isFinite(range[0]) ||
        !Number.isFinite(range[1]) || range[0] > range[1]) {
      throw Error('weather_domain_contract_field_' + field)
    }
    if (!Number.isFinite(value)) reasons.push(field + ':missing_or_nonfinite')
    else if (value < rule.constraints.min || value > rule.constraints.max) reasons.push(field + ':outside_source_domain')
    else if (value < range[0] || value > range[1]) outsideTraining.push(field)
  }
  return {status: reasons.length ? 'reject' : 'within_source_domain', reasons, outsideTraining}
}

export function verifyWeatherRows(domainFields, ranges, rows) {
  const outsideTraining = []
  for (const row of rows) {
    const verdict = checkDailyWeatherRow(domainFields, ranges, row.values)
    if (verdict.status === 'reject') throw Error('weather_domain_rejected_' + row.date + '_' + verdict.reasons.join(','))
    for (const field of verdict.outsideTraining) {
      outsideTraining.push({date: row.date, field, value: row.values[Object.keys(DAILY_FIELDS).indexOf(field)]})
    }
  }
  return {acceptedRows: rows.length, rejectedRows: 0, outsideTraining}
}
