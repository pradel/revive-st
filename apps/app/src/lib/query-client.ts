import { QueryClient } from "@tanstack/react-query";

/** The app's one query client; code outside React uses it to refetch queries. */
export const queryClient = new QueryClient({});
