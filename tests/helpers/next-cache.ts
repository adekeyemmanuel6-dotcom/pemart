// Test double for next/cache: run the function every time (no caching) and ignore tag revalidation.
export const unstable_cache = <T extends (...a: never[]) => unknown>(fn: T) => fn;
export const revalidateTag = () => {};
export const revalidatePath = () => {};
