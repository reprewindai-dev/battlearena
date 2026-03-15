export function isMockRuntimeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return (
    process.env.ARENA_FORCE_MOCK_AUTH === "1" ||
    process.env.NEXT_PUBLIC_ARENA_FORCE_MOCK_AUTH === "1"
  );
}
