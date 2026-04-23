import { emptyCollectionCounts, type CollectionCounts } from "../core/CollectionBook.js";
import { CONFIG } from "../core/Config.js";

const STORAGE_KEY = "ridiculous-hook-html5-profile-v1";

export type PlayerProfile = {
  coins: number;
  lineLengthM: number;
  hasExtraLure: boolean;
  hasGoldenReel: boolean;
  hasLuckCharm: boolean;
  hasCompletedFtue: boolean;
  hasSeenChestTutorial: boolean;
  hasSeenTrashTutorial: boolean;
  collectionCounts: CollectionCounts;
};

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaultProfile();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return sanitizeProfile(parsed);
  } catch {
    return defaultProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
  } catch {
    // Ignore persistence failures and keep the session playable.
  }
}

function defaultProfile(): PlayerProfile {
  return {
    coins: 0,
    lineLengthM: CONFIG.lineLengthDefaultM,
    hasExtraLure: false,
    hasGoldenReel: false,
    hasLuckCharm: false,
    hasCompletedFtue: false,
    hasSeenChestTutorial: false,
    hasSeenTrashTutorial: false,
    collectionCounts: emptyCollectionCounts(),
  };
}

function sanitizeProfile(profile: Partial<PlayerProfile>): PlayerProfile {
  const rawCounts = profile.collectionCounts ?? emptyCollectionCounts();
  const collectionCounts: CollectionCounts = {};
  for (const [id, count] of Object.entries(rawCounts)) {
    const nextCount = Math.max(0, Math.floor(Number(count) || 0));
    if (nextCount > 0) {
      collectionCounts[id] = nextCount;
    }
  }
  const inferredHasProgress =
    Math.max(0, Math.floor(profile.coins ?? 0)) > 0 ||
    Boolean(profile.hasExtraLure) ||
    Math.max(0, Math.floor((profile as { extraLureLevel?: number }).extraLureLevel ?? 0)) > 0 ||
    Boolean(profile.hasGoldenReel) ||
    Boolean(profile.hasLuckCharm) ||
    Object.keys(collectionCounts).length > 0 ||
    Math.max(
      CONFIG.lineLengthDefaultM,
      Math.floor(profile.lineLengthM ?? CONFIG.lineLengthDefaultM),
    ) > CONFIG.lineLengthDefaultM;
  return {
    coins: Math.max(0, Math.floor(profile.coins ?? 0)),
    lineLengthM: Math.max(
      CONFIG.lineLengthDefaultM,
      Math.floor(profile.lineLengthM ?? CONFIG.lineLengthDefaultM),
    ),
    hasExtraLure:
      Boolean(profile.hasExtraLure) ||
      Math.max(0, Math.floor((profile as { extraLureLevel?: number }).extraLureLevel ?? 0)) > 0,
    hasGoldenReel: Boolean(profile.hasGoldenReel),
    hasLuckCharm: Boolean(profile.hasLuckCharm),
    hasCompletedFtue:
      typeof profile.hasCompletedFtue === "boolean"
        ? profile.hasCompletedFtue
        : inferredHasProgress,
    hasSeenChestTutorial:
      Boolean(profile.hasSeenChestTutorial) || (collectionCounts.treasureChest ?? 0) > 0,
    hasSeenTrashTutorial:
      Boolean(profile.hasSeenTrashTutorial) || (collectionCounts.trashBag ?? 0) > 0,
    collectionCounts,
  };
}
