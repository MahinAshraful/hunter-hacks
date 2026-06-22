import { PDFDocument } from 'pdf-lib';
import type { Estimate } from './overcharge';

export type Ra89Input = {
  // §1-4 tenant contact
  tenantName?: string;
  unit?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  address: string; // subject building

  // §5 phones
  phoneHome?: string;
  phoneDay?: string;

  // §6-7 tenant classification
  tenantType?: 'prime' | 'sub' | 'hotel' | 'roommate';
  scrieDrie?: boolean;
  section8?: 'none' | 'hud' | 'nycha' | 'hcv' | 'hpd';
  coop?: boolean;

  // §8 move-in
  moveInDate?: string;       // ISO YYYY-MM-DD
  initialRent?: number;

  // §10 electricity
  electricityIncluded?: boolean | null;

  // §11 owner/agent
  ownerName?: string;
  ownerAddress?: string;
  ownerPhone?: string;

  // §13 causes
  causes?: string[];

  // §14 narrative (extracted from AI draft block B)
  narrative: string;

  // §15 security deposit
  securityDepositAmount?: number;
  securityDepositPaidOn?: string;

  // §16 court
  raisedInCourt?: boolean;
  courtIndexNo?: string;

  // estimate for §9 + §17 rent history
  estimate: Estimate;
};

function set(form: Awaited<ReturnType<typeof PDFDocument.prototype.getForm>>, name: string, value: string) {
  try { form.getTextField(name).setText(value); } catch { /* field absent or wrong type */ }
}

function check(form: Awaited<ReturnType<typeof PDFDocument.prototype.getForm>>, name: string, checked: boolean) {
  try {
    const cb = form.getCheckBox(name);
    if (checked) cb.check(); else cb.uncheck();
  } catch { /* skip */ }
}

function splitIso(iso: string | undefined): { m: string; d: string; y: string } {
  if (!iso) return { m: '', d: '', y: '' };
  const [y, m, d] = iso.split('-');
  return { m: m ?? '', d: d ?? '', y: y ?? '' };
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function fillRa89Form(input: Ra89Input): Promise<Uint8Array> {
  const res = await fetch('/ra-89-template.pdf');
  if (!res.ok) throw new Error('Could not load RA-89 template PDF');
  const buf = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buf);
  const form = pdfDoc.getForm();

  const s = (name: string, value: string) => set(form, name, value);
  const c = (name: string, on: boolean) => check(form, name, on);

  // ── §1 Tenant name ──────────────────────────────────────────────────
  s("Tenant's Last Name First Name Middle Initial", input.tenantName ?? '');

  // ── §2-3 Mailing address ────────────────────────────────────────────
  const aptSuffix = input.unit ? `, Apt ${input.unit}` : '';
  s('Current Address Apt No', (input.mailingAddress ?? input.address) + aptSuffix);
  const cityStateZip = [input.mailingCity, input.mailingState, input.mailingZip]
    .filter(Boolean).join(', ');
  s('City State Zip Code', cityStateZip);

  // ── §4 Subject building ─────────────────────────────────────────────
  s('Subject Builing Address and Apartment Number', input.address + aptSuffix);

  // ── §5 Phones ───────────────────────────────────────────────────────
  s('5  Telephone Number Home', input.phoneHome ?? '');
  s('Day time', input.phoneDay ?? '');

  // ── §6 Tenant type ──────────────────────────────────────────────────
  // Check Box5=prime, 6=sub-tenant, 7=hotel/SRO, 8=roommate
  c('Check Box5', input.tenantType === 'prime' || !input.tenantType);
  c('Check Box6', input.tenantType === 'sub');
  c('Check Box7', input.tenantType === 'hotel');
  c('Check Box8', input.tenantType === 'roommate');

  // ── §6a SCRIE / DRIE ────────────────────────────────────────────────
  // Check Box9=yes, Check Box10=no
  c('Check Box9', !!input.scrieDrie);
  c('Check Box10', !input.scrieDrie);

  // ── §6b Section 8 ───────────────────────────────────────────────────
  // Check Box11=none, 12=HUD, 13=NYCHA, 14=HCV, 15=HPD
  const s8 = input.section8 ?? 'none';
  c('Check Box11', s8 === 'none');
  c('Check Box12', s8 === 'hud');
  c('Check Box13', s8 === 'nycha');
  c('Check Box14', s8 === 'hcv');
  c('Check Box15', s8 === 'hpd');

  // ── §7 Co-op ────────────────────────────────────────────────────────
  // Check Box16=yes, Check Box17=no
  c('Check Box16', !!input.coop);
  c('Check Box17', !input.coop);

  // ── §8 Move-in ──────────────────────────────────────────────────────
  const firstLease = input.estimate.years_analyzed[0];
  const moveIn = input.moveInDate ?? firstLease?.lease_start;
  const mi = splitIso(moveIn);
  s('Month', mi.m);
  s('Day', mi.d);
  s('Year', mi.y);
  if (input.initialRent) s('rent', usd(input.initialRent));

  // ── §9 Current rent ─────────────────────────────────────────────────
  s('My current rent is', usd(input.estimate.actual_rent_monthly));

  // ── §10 Electricity ─────────────────────────────────────────────────
  // Check Box18=yes, Check Box19=no
  c('Check Box18', input.electricityIncluded === true);
  c('Check Box19', input.electricityIncluded === false);

  // ── §11 Owner / managing agent ──────────────────────────────────────
  s('Name', input.ownerName ?? '');
  // HPD address format: "123 MAIN ST · NEW YORK, NY 10001" — split on ·
  const ownerAddrParts = (input.ownerAddress ?? '').split('·').map((p) => p.trim());
  s('Number/Street', ownerAddrParts[0] ?? '');
  s('City State Zip Code_3', ownerAddrParts[1] ?? '');
  s('Telephone Number', input.ownerPhone ?? '');

  // ── §13 Overcharge period ───────────────────────────────────────────
  const overcharged = input.estimate.years_analyzed.filter((y) => y.overcharge_monthly > 0);
  if (overcharged.length > 0) {
    const from = splitIso(overcharged[0].lease_start);
    const to = splitIso(overcharged[overcharged.length - 1].lease_end);
    s('Month_4', from.m); s('Day_4', from.d); s('Year_4', from.y);
    s('Month_5', to.m);   s('Day_5', to.d);   s('Year_5', to.y);
  }

  // ── §13 Causes ──────────────────────────────────────────────────────
  // Check Box25=other/overcharge, 26=MCI, 27=IAI, 28=rent reduction order,
  // 29=missing registrations, 30=parking/fees, 31=FMRA/security deposit
  const causes = input.causes ?? ['other'];
  c('Check Box25', causes.includes('other'));
  c('Check Box26', causes.includes('mci'));
  c('Check Box27', causes.includes('iai'));
  c('Check Box28', causes.includes('rent_reduction_order'));
  c('Check Box29', causes.includes('missing_registrations'));
  c('Check Box30', causes.includes('parking') || causes.includes('illegal_fees'));
  c('Check Box31', causes.includes('fmra') || causes.includes('security_deposit'));

  // ── §14 Narrative ───────────────────────────────────────────────────
  s('Text32', input.narrative);

  // ── §15 Security deposit ────────────────────────────────────────────
  if (input.securityDepositAmount) {
    s('Security Deposit', usd(input.securityDepositAmount));
    const dp = splitIso(input.securityDepositPaidOn);
    s('Month_6', dp.m); s('Day_6', dp.d); s('Year_6', dp.y);
  }

  // ── §16 Raised in court ─────────────────────────────────────────────
  c('Check Box35', !!input.raisedInCourt);
  c('Check Box36', !input.raisedInCourt);
  if (input.raisedInCourt && input.courtIndexNo) s('Index No', input.courtIndexNo);

  // ── §17 Rent history (up to 7 lease rows) ───────────────────────────
  const leases = input.estimate.years_analyzed.slice(0, 7);
  leases.forEach((lease, i) => {
    const n = i + 1;
    const fs = splitIso(lease.lease_start);
    const fe = splitIso(lease.lease_end);
    s(`Lease Periods From  To${n}`, `${fs.m}/${fs.d}/${fs.y} – ${fe.m}/${fe.d}/${fe.y}`);
    s(`Lease Amount ${n}`, usd(lease.actual_monthly));
  });

  // Yearly rent summary columns (Current Year = most recent lease)
  const yearLabels = ['Current Year', 'Last Year', '2 Years Prior', '3 Years Prior', '4 Years Prior', '5 Years Prior', '6 Years Prior'];
  const sorted = [...input.estimate.years_analyzed].sort((a, b) => b.lease_start.localeCompare(a.lease_start));
  sorted.slice(0, 7).forEach((lease, i) => {
    s(yearLabels[i], usd(lease.actual_monthly));
  });

  // ── §19 Evidence checkboxes ─────────────────────────────────────────
  // Check Box39=leases, 40=rent receipts, 41=cancelled checks,
  // Check Box42=money orders, 43=other
  c('Check Box39', true); // always attach leases
  c('Check Box40', true); // always attach rent receipts

  // ── Signature date (page 4) — leave signature line blank ────────────
  s('Date', new Date().toLocaleDateString('en-US'));

  return pdfDoc.save({ updateFieldAppearances: false });
}

export function downloadRa89(bytes: Uint8Array, bbl: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RA-89-filled-${bbl}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
