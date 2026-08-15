/**
 * Formatting utilities for roles, names and metrics to enhance safety and privacy.
 */

/**
 * Maps database roles to safe, abstract display roles:
 * '店長' -> 'S'
 * 'AM'   -> 'A'
 * 'BM'   -> 'B'
 */
export function displayRole(role: string | null | undefined): string {
  if (!role) return '';
  if (role === '店長') return 'Ｓ';
  if (role === 'AM') return 'A';
  if (role === 'BM') return 'B';
  return role;
}

/**
 * Extracts only the surname (family name) from a full Japanese space-separated or non-spaced name.
 * e.g., "田中 太郎" -> "田中", "山田花子" -> "山田"
 */
export function getSurnameOnly(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const parts = trimmed.split(/[\s　]+/); // Split by half-width or full-width space
  if (parts.length > 1) {
    return parts[0];
  }
  // Fallback for non-spaced Japanese names:
  // If the string length is 3 or more, take first 2 characters.
  // If 2 characters, take first character.
  if (trimmed.length > 2) {
    return trimmed.substring(0, 2);
  }
  if (trimmed.length === 2) {
    return trimmed.charAt(0);
  }
  return trimmed;
}

/**
 * Formats a staff/user's full name to Surname(first character of given name).
 * e.g., "田中 太郎" -> "田中(太)", "山田花子" -> "山田(花)"
 */
export function formatStaffName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const parts = trimmed.split(/[\s　]+/);
  if (parts.length > 1) {
    const surname = parts[0];
    const firstOfGiven = parts[1].charAt(0);
    return `${surname}(${firstOfGiven})`;
  }
  // Fallback for non-spaced Japanese names
  if (trimmed.length > 2) {
    const surname = trimmed.substring(0, 2);
    const firstOfGiven = trimmed.charAt(2);
    return `${surname}(${firstOfGiven})`;
  }
  if (trimmed.length === 2) {
    return `${trimmed.charAt(0)}(${trimmed.charAt(1)})`;
  }
  return trimmed;
}

/**
 * Abbreviates long, full store names to their standard short codes or regional abbreviations to enhance layout consistency.
 * e.g. "京急横浜駅北口" -> "北口", "サミット横浜岡野" -> "岡野", "コースカベイサイドストアーズ" -> "汐入"
 */
export function abbreviateStoreName(storeName: string | null | undefined): string {
  if (!storeName) return '';
  const trimmed = storeName.trim();
  
  if (trimmed.includes('追浜')) return '追浜';
  if (trimmed.includes('北口') || trimmed.includes('京急横浜駅北口')) return '北口';
  if (trimmed.includes('別所') || trimmed.includes('上大岡') || trimmed.includes('ヨークフーズ')) return '別所';
  if (trimmed.includes('文庫') || trimmed.includes('金沢文庫')) return '文庫';
  if (trimmed.includes('MM') || trimmed.includes('ＭＭ') || trimmed.includes('みなとみらい')) return 'MM';
  if (trimmed.includes('ｶﾐｵ') || trimmed.includes('カミオ')) return 'ｶﾐｵ';
  if (trimmed.includes('久里')) return '久里';
  if (trimmed.includes('コースカ') || trimmed.includes('汐入')) return '汐入';
  if (trimmed.includes('市役')) return '市役';
  if (trimmed.includes('岡野') || trimmed.includes('サミット')) return '岡野';
  if (trimmed.includes('保土')) return '保土';
  
  return trimmed;
}

