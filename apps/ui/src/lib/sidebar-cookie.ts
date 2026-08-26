/**
 * Shared by the client Sidebar (which writes the cookie) and the server layout
 * (which reads it to render the right width on first paint).
 *
 * These deliberately live outside components/ui/sidebar.tsx. That file is
 * "use client", so importing a plain constant from it into a Server Component
 * yields a client-reference proxy rather than the string: cookies().get() was
 * handed a function, returned undefined, and the rail rendered expanded on every
 * load no matter what the user had chosen - guaranteeing exactly the flash the
 * server-side read exists to prevent.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
