// 首屏飄浮小卡數量的範圍（瀏覽器與伺服器都能用，不可引用 supabase）
export const HERO_CARDS_MIN = 3;
export const HERO_CARDS_MAX = 12;
export const HERO_CARDS_DEFAULT = 5;
export const clampHeroCards = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(HERO_CARDS_MAX, Math.max(HERO_CARDS_MIN, v)) : HERO_CARDS_DEFAULT;
};
