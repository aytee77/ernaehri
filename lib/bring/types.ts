/** A Bring! shopping list as returned by `GET /bringusers/{uuid}/lists`. */
export interface BringList {
  listUuid: string;
  name: string;
  theme: string | null;
}

/** Result of `POST /bringauth`. Access tokens are short lived, so the client caches them. */
export interface BringSession {
  uuid: string;
  name: string;
  accessToken: string;
  refreshToken: string | null;
}

/** One entry the Bring! list receives: the item plus the small quantity line under it. */
export interface BringItem {
  name: string;
  /** Bring!'s "specification", i.e. "1.2 kg" shown under the item name. */
  specification: string;
}

/** What `POST /bringauth` answers before it is mapped to `BringSession`. */
export interface RawBringAuth {
  name?: string;
  uuid?: string;
  access_token?: string;
  refresh_token?: string;
  message?: string;
  error?: string;
  error_description?: string;
  errorcode?: number;
}

export interface RawBringLists {
  lists?: Array<{ listUuid?: string; name?: string; theme?: string }>;
}

export interface RawBringItems {
  purchase?: Array<{ name?: string; specification?: string }>;
  recently?: Array<{ name?: string; specification?: string }>;
}

/** What the shopping list panel sends along so the export matches what is on screen. */
export interface BringExportOptions {
  listUuid: string | null;
  /** Include the one-off pantry & spice lines? */
  includePantry: boolean;
  /** Only export lines that are not ticked off yet? */
  onlyOpen: boolean;
}

export interface BringExportSummary {
  listName: string;
  /** Items that were pushed to Bring!. */
  added: string[];
  /** Items that were already on the Bring! list (or empty after sanitising). */
  skipped: string[];
}

export interface BringStatus {
  /** Are `BRING_EMAIL` / `BRING_PASSWORD` configured? */
  configured: boolean;
  lists: BringList[];
  /** `listUuid` of the list `BRING_LIST_NAME` points at, if it exists. */
  defaultListUuid: string | null;
  /** Name of the list that would be created on send (`BRING_LIST_NAME`, missing). */
  createListName: string | null;
  /** Why Bring! could not be reached – never contains credentials. */
  notice: string | null;
}
