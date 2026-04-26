/**
 * NYC HPD Multiple Dwelling Registration lookup.
 *
 * Two NYC OpenData endpoints are joined here:
 *   1. Registrations  — `tesw-yqqr` (one row per registered building, key: bin)
 *   2. Contacts       — `feu5-w2e2` (rows per contact, joined by registrationid)
 *
 * Why this exists: RA-89 §11 ("Mailing Address of Owner/Agent") is the
 * field tenants get wrong most often, and a wrong/blank §11 is a common
 * reason DHCR returns the complaint. HPD requires every building with 3+
 * units to register an owner + a managing agent annually, and the data is
 * public and BIN-keyed. We pre-fill it.
 */

const HPD_REGISTRATIONS_URL =
  'https://data.cityofnewyork.us/resource/tesw-yqqr.json';
const HPD_CONTACTS_URL = 'https://data.cityofnewyork.us/resource/feu5-w2e2.json';

export type HpdContact = {
  type: string; // CorporateOwner, IndividualOwner, Agent, HeadOfficer, Officer, etc.
  name: string; // best display name we can build (corp name OR person name)
  address: string; // single-line mailing address
  phone?: string; // not in the public dataset; left undefined
};

export type HpdLookup = {
  bin: string;
  registrationId: string | null;
  registrationDate: string | null; // ISO date of last registration
  registrationEndDate: string | null; // when this registration expires
  owner: HpdContact | null;
  agent: HpdContact | null;
  raw: number; // count of contacts returned (for debugging)
};

const CONTACT_TYPES = {
  // Listed in the order we'd prefer to surface them to the tenant for §11.
  // RA-89 wants the legal owner; managing agent address is also acceptable
  // and is what tenants more commonly receive correspondence at.
  owner: ['CorporateOwner', 'IndividualOwner', 'JointOwner'],
  agent: ['Agent', 'SiteManager'],
};

type Registration = {
  registrationid?: string;
  bin?: string;
  lastregistrationdate?: string;
  registrationenddate?: string;
};

type Contact = {
  registrationid?: string;
  type?: string;
  contactdescription?: string;
  corporationname?: string;
  firstname?: string;
  middleinitial?: string;
  lastname?: string;
  businesshousenumber?: string;
  businessstreetname?: string;
  businessapartment?: string;
  businesscity?: string;
  businessstate?: string;
  businesszip?: string;
};

function buildName(c: Contact): string {
  const corp = c.corporationname?.trim();
  if (corp) return corp;
  const parts = [c.firstname, c.middleinitial, c.lastname]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && s.length > 0);
  return parts.join(' ');
}

function buildAddress(c: Contact): string {
  const street = [c.businesshousenumber, c.businessstreetname]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && s.length > 0)
    .join(' ');
  const apt = c.businessapartment?.trim();
  const cityState = [c.businesscity?.trim(), c.businessstate?.trim()]
    .filter((s): s is string => !!s && s.length > 0)
    .join(', ');
  const zip = c.businesszip?.trim();
  const line1 = apt ? `${street}, Apt ${apt}` : street;
  const line2 = [cityState, zip].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(' · ');
}

function pickContact(contacts: Contact[], allowedTypes: string[]): HpdContact | null {
  for (const t of allowedTypes) {
    const hit = contacts.find((c) => c.type === t);
    if (hit) {
      const name = buildName(hit);
      const address = buildAddress(hit);
      if (!name && !address) continue;
      return { type: hit.type ?? t, name, address };
    }
  }
  return null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Look up the HPD-registered owner + agent for an NYC building by BIN.
 * Returns null only if the building is not registered with HPD (small
 * buildings, recently constructed, or registration lapsed).
 */
export async function lookupOwnerByBin(
  bin: string,
  signal?: AbortSignal,
): Promise<HpdLookup | null> {
  if (!/^\d{6,8}$/.test(bin)) return null;

  const regUrl = `${HPD_REGISTRATIONS_URL}?bin=${encodeURIComponent(
    bin,
  )}&$order=lastregistrationdate%20DESC&$limit=1`;
  const regs = await fetchJson<Registration[]>(regUrl, signal);
  if (!regs || regs.length === 0) return null;

  const reg = regs[0];
  const registrationId = reg.registrationid ?? null;
  if (!registrationId) {
    return {
      bin,
      registrationId: null,
      registrationDate: null,
      registrationEndDate: null,
      owner: null,
      agent: null,
      raw: 0,
    };
  }

  const contactsUrl = `${HPD_CONTACTS_URL}?registrationid=${encodeURIComponent(
    registrationId,
  )}&$limit=100`;
  const contacts = (await fetchJson<Contact[]>(contactsUrl, signal)) ?? [];

  return {
    bin,
    registrationId,
    registrationDate: reg.lastregistrationdate ?? null,
    registrationEndDate: reg.registrationenddate ?? null,
    owner: pickContact(contacts, CONTACT_TYPES.owner),
    agent: pickContact(contacts, CONTACT_TYPES.agent),
    raw: contacts.length,
  };
}
