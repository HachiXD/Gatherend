import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions, Platform } from "react-native";

const STORAGE_PREFIX = "keyboard-height:v1";
const MIN_VALID_KEYBOARD_HEIGHT = 180;
const ESTIMATED_KEYBOARD_RATIO = 0.35;
const MAX_KEYBOARD_HEIGHT_RATIO = 0.75;
export const KEYBOARD_HEIGHT_WRITE_THRESHOLD = 2;
export const KEYBOARD_HEIGHT_UI_THRESHOLD = 8;

type KeyboardHeightRecord = {
  height: number;
  updatedAt: number;
};

export type KeyboardHeightDimensions = {
  platform: string;
  screenHeight: number;
  screenWidth: number;
  windowHeight: number;
  windowWidth: number;
};

const memoryCache = new Map<string, number>();
const persistedCache = new Map<string, number>();
const pendingLoads = new Map<string, Promise<number | null>>();

function roundDimension(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getKeyboardHeightDimensions(): KeyboardHeightDimensions {
  const screen = Dimensions.get("screen");
  const window = Dimensions.get("window");

  return {
    platform: Platform.OS,
    screenHeight: screen.height,
    screenWidth: screen.width,
    windowHeight: window.height,
    windowWidth: window.width,
  };
}

function getStorageKey(dimensions: KeyboardHeightDimensions) {
  return [
    STORAGE_PREFIX,
    dimensions.platform,
    `${roundDimension(dimensions.windowWidth)}x${roundDimension(
      dimensions.windowHeight,
    )}`,
    `${roundDimension(dimensions.screenWidth)}x${roundDimension(
      dimensions.screenHeight,
    )}`,
  ].join(":");
}

function isValidKeyboardHeight(
  dimensions: KeyboardHeightDimensions,
  height: number,
) {
  if (!Number.isFinite(height)) return false;

  return (
    height >= MIN_VALID_KEYBOARD_HEIGHT &&
    height <= dimensions.windowHeight * MAX_KEYBOARD_HEIGHT_RATIO
  );
}

export function getEstimatedKeyboardHeight(
  dimensions: KeyboardHeightDimensions,
) {
  return clamp(
    dimensions.windowHeight * ESTIMATED_KEYBOARD_RATIO,
    MIN_VALID_KEYBOARD_HEIGHT,
    dimensions.windowHeight * MAX_KEYBOARD_HEIGHT_RATIO,
  );
}

export function getCachedKeyboardHeight(
  dimensions: KeyboardHeightDimensions,
) {
  const key = getStorageKey(dimensions);
  const height = memoryCache.get(key);

  return typeof height === "number" &&
    isValidKeyboardHeight(dimensions, height)
    ? height
    : null;
}

export async function loadPersistedKeyboardHeight(
  dimensions: KeyboardHeightDimensions,
) {
  const key = getStorageKey(dimensions);
  const cachedHeight = getCachedKeyboardHeight(dimensions);

  if (cachedHeight !== null) {
    return cachedHeight;
  }

  const pendingLoad = pendingLoads.get(key);
  if (pendingLoad) {
    return pendingLoad;
  }

  const load = AsyncStorage.getItem(key)
    .then((value) => {
      if (!value) return null;

      const record = JSON.parse(value) as Partial<KeyboardHeightRecord>;
      const height = record.height;

      if (typeof height !== "number") return null;
      if (!isValidKeyboardHeight(dimensions, height)) return null;

      memoryCache.set(key, height);
      persistedCache.set(key, height);

      return height;
    })
    .catch(() => null)
    .finally(() => {
      pendingLoads.delete(key);
    });

  pendingLoads.set(key, load);

  return load;
}

export async function saveMeasuredKeyboardHeight(
  dimensions: KeyboardHeightDimensions,
  height: number,
) {
  if (!isValidKeyboardHeight(dimensions, height)) return;

  const key = getStorageKey(dimensions);
  const persistedHeight = persistedCache.get(key);
  memoryCache.set(key, height);

  if (
    typeof persistedHeight === "number" &&
    Math.abs(persistedHeight - height) <= KEYBOARD_HEIGHT_WRITE_THRESHOLD
  ) {
    return;
  }

  const record: KeyboardHeightRecord = {
    height,
    updatedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(record));
    persistedCache.set(key, height);
  } catch {
    // Memory cache still keeps the session accurate if disk writes fail.
  }
}
