export interface VersionEffectivePeriod {
  effectiveFrom: Date | null
  effectiveTo: Date | null
}

/**
 * 기준일에 해당 버전이 유효했는지 판단한다. effectiveFrom/effectiveTo가
 * 없으면(정보 미상) 해당 경계는 제한하지 않는다.
 */
export function isEffectiveAt(version: VersionEffectivePeriod, referenceDate: Date): boolean {
  if (version.effectiveFrom && referenceDate < version.effectiveFrom) return false
  if (version.effectiveTo && referenceDate > version.effectiveTo) return false
  return true
}

/**
 * 기준일에 유효한 버전 중 effectiveFrom이 가장 최근인 것을 선택한다.
 * (개정 전/후 버전이 함께 있을 때 기준일에 맞는 버전을 우선 적용하기 위함,
 * 요구사항 §2 기준일 적용)
 */
export function pickApplicableVersion<T extends VersionEffectivePeriod>(
  versions: readonly T[],
  referenceDate: Date,
): T | null {
  const effective = versions.filter((v) => isEffectiveAt(v, referenceDate))
  if (effective.length === 0) return null

  let best = effective[0]
  for (const candidate of effective) {
    const bestFrom = best.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY
    const candidateFrom = candidate.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY
    if (candidateFrom > bestFrom) best = candidate
  }
  return best
}
