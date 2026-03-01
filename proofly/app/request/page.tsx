'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, saveSession } from '@/lib/session';
import { getState } from '@/lib/states';
import StepIndicator from '@/components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLORADO_COUNTIES = [
  'Adams','Alamosa','Arapahoe','Archuleta','Baca','Bent','Boulder','Broomfield',
  'Chaffee','Cheyenne','Clear Creek','Conejos','Costilla','Crowley','Custer',
  'Delta','Denver','Dolores','Douglas','Eagle','El Paso','Elbert','Fremont',
  'Garfield','Gilpin','Grand','Gunnison','Hinsdale','Huerfano','Jackson',
  'Jefferson','Kiowa','Kit Carson','La Plata','Lake','Larimer','Las Animas',
  'Lincoln','Logan','Mesa','Mineral','Moffat','Montezuma','Montrose','Morgan',
  'Otero','Ouray','Park','Phillips','Pitkin','Prowers','Pueblo','Rio Blanco',
  'Rio Grande','Routt','Saguache','San Juan','San Miguel','Sedgwick','Summit',
  'Teller','Washington','Weld','Yuma',
];

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Myself (the registrant)' },
  { value: 'parent', label: 'Parent' },
  { value: 'legal_guardian', label: 'Legal guardian' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child (of registrant)' },
  { value: 'sibling', label: 'Sibling' },
];

const PURPOSE_OPTIONS = [
  { value: 'voter_registration', label: 'Voter registration / SAVE Act compliance' },
  { value: 'passport', label: 'Passport application' },
  { value: 'passport_renewal', label: 'Passport renewal' },
  { value: 'legal', label: 'Legal / court requirement' },
  { value: 'benefits', label: 'Government benefits / Social Security' },
  { value: 'other', label: 'Other' },
];

type FormData = {
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  motherNameAtBirth: string;
  fatherName: string;
  relationship: string;
  purpose: string;
  purposeOther: string;
  copies: number;
  mailingAddress1: string;
  mailingAddress2: string;
  city: string;
  state: string;
  zip: string;
  email: string;
};

const EMPTY_FORM: FormData = {
  fullName: '', dateOfBirth: '', placeOfBirth: '', motherNameAtBirth: '',
  fatherName: '', relationship: '', purpose: '', purposeOther: '',
  copies: 1, mailingAddress1: '', mailingAddress2: '', city: '',
  state: 'CO', zip: '', email: '',
};

export default function RequestPage() {
  const router = useRouter();
  const [stateCode, setStateCode] = useState('CO');
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Load existing session on mount
  useEffect(() => {
    const session = getSession();
    if (session.stateCode) setStateCode(session.stateCode);
    if (session.form) {
      setForm(f => ({ ...f, ...(session.form as FormData) }));
    }
  }, []);

  const set = (field: keyof FormData, value: string | number) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.fullName.trim()) e.fullName = 'Required';
    if (!form.dateOfBirth) e.dateOfBirth = 'Required';
    if (!form.placeOfBirth.trim()) e.placeOfBirth = 'Required';
    if (!form.motherNameAtBirth.trim()) e.motherNameAtBirth = 'Required';
    if (!form.fatherName.trim()) e.fatherName = 'Required';
    if (!form.relationship) e.relationship = 'Required';
    if (!form.purpose) e.purpose = 'Required';
    if (form.purpose === 'other' && !form.purposeOther.trim()) e.purposeOther = 'Required';
    if (!form.mailingAddress1.trim()) e.mailingAddress1 = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.zip.trim()) e.zip = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.copies < 1 || form.copies > 10) e.copies = 'Between 1 and 10';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    saveSession({ stateCode, form });
    router.push('/upload');
  };

  let stateConfig;
  try { stateConfig = getState(stateCode); } catch { stateConfig = null; }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator current={1} />

        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Birth Certificate Request</CardTitle>
            <p className="text-zinc-400 text-sm">
              {stateConfig?.name ?? 'Colorado'} •{' '}
              {stateConfig?.vitalRecords.agencyName ?? 'CDPHE'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

              {/* Registrant details */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Registrant Information
                </legend>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Full name at birth" error={errors.fullName} required>
                    <Input
                      value={form.fullName}
                      onChange={e => set('fullName', e.target.value)}
                      placeholder="Last, First Middle"
                      className={inputCls(errors.fullName)}
                    />
                  </Field>

                  <Field label="Date of birth" error={errors.dateOfBirth} required>
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={e => set('dateOfBirth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className={inputCls(errors.dateOfBirth)}
                    />
                  </Field>
                </div>

                <Field label="Place of birth (city or county in Colorado)" error={errors.placeOfBirth} required>
                  <Select value={form.placeOfBirth} onValueChange={v => set('placeOfBirth', v)}>
                    <SelectTrigger className={selectCls(errors.placeOfBirth)}>
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {COLORADO_COUNTIES.map(c => (
                        <SelectItem key={c} value={c} className="text-white hover:bg-zinc-800">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Mother's full name at birth" error={errors.motherNameAtBirth} required>
                    <Input
                      value={form.motherNameAtBirth}
                      onChange={e => set('motherNameAtBirth', e.target.value)}
                      placeholder="Including maiden name"
                      className={inputCls(errors.motherNameAtBirth)}
                    />
                  </Field>

                  <Field label="Father's full name" error={errors.fatherName} required>
                    <Input
                      value={form.fatherName}
                      onChange={e => set('fatherName', e.target.value)}
                      className={inputCls(errors.fatherName)}
                    />
                  </Field>
                </div>
              </fieldset>

              {/* Request details */}
              <fieldset className="space-y-4 pt-2 border-t border-zinc-800">
                <legend className="text-sm font-semibold text-zinc-300 uppercase tracking-wider pt-4">
                  Request Details
                </legend>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Your relationship to registrant" error={errors.relationship} required>
                    <Select value={form.relationship} onValueChange={v => set('relationship', v)}>
                      <SelectTrigger className={selectCls(errors.relationship)}>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {RELATIONSHIP_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-800">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Purpose of request" error={errors.purpose} required>
                    <Select value={form.purpose} onValueChange={v => set('purpose', v)}>
                      <SelectTrigger className={selectCls(errors.purpose)}>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {PURPOSE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-white hover:bg-zinc-800">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {form.purpose === 'other' && (
                  <Field label="Please describe the purpose" error={errors.purposeOther} required>
                    <Input
                      value={form.purposeOther}
                      onChange={e => set('purposeOther', e.target.value)}
                      className={inputCls(errors.purposeOther)}
                    />
                  </Field>
                )}

                <Field
                  label="Number of certified copies"
                  error={errors.copies}
                  hint={`$25 first copy + $20 each additional`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => set('copies', Math.max(1, form.copies - 1))}
                      className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center text-xl font-bold transition"
                    >
                      −
                    </button>
                    <span className="text-2xl font-bold w-8 text-center">{form.copies}</span>
                    <button
                      type="button"
                      onClick={() => set('copies', Math.min(10, form.copies + 1))}
                      className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center text-xl font-bold transition"
                    >
                      +
                    </button>
                  </div>
                </Field>
              </fieldset>

              {/* Delivery address */}
              <fieldset className="space-y-4 pt-2 border-t border-zinc-800">
                <legend className="text-sm font-semibold text-zinc-300 uppercase tracking-wider pt-4">
                  Delivery Address
                </legend>
                <p className="text-xs text-zinc-500">
                  CDPHE will mail the birth certificate directly to this address.
                </p>

                <Field label="Address line 1" error={errors.mailingAddress1} required>
                  <Input
                    value={form.mailingAddress1}
                    onChange={e => set('mailingAddress1', e.target.value)}
                    placeholder="Street address"
                    className={inputCls(errors.mailingAddress1)}
                  />
                </Field>

                <Field label="Address line 2" error={errors.mailingAddress2}>
                  <Input
                    value={form.mailingAddress2}
                    onChange={e => set('mailingAddress2', e.target.value)}
                    placeholder="Apt, unit, suite (optional)"
                    className={inputCls(errors.mailingAddress2)}
                  />
                </Field>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="City" error={errors.city} required className="col-span-2 md:col-span-1">
                    <Input
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className={inputCls(errors.city)}
                    />
                  </Field>
                  <Field label="State" error={errors.state}>
                    <Input
                      value={form.state}
                      onChange={e => set('state', e.target.value.toUpperCase())}
                      maxLength={2}
                      className={inputCls(errors.state)}
                    />
                  </Field>
                  <Field label="ZIP" error={errors.zip} required>
                    <Input
                      value={form.zip}
                      onChange={e => set('zip', e.target.value)}
                      maxLength={10}
                      className={inputCls(errors.zip)}
                    />
                  </Field>
                </div>
              </fieldset>

              {/* Contact */}
              <fieldset className="space-y-4 pt-2 border-t border-zinc-800">
                <legend className="text-sm font-semibold text-zinc-300 uppercase tracking-wider pt-4">
                  Confirmation Email
                </legend>

                <Field
                  label="Email address"
                  error={errors.email}
                  hint="We'll send your tracking number here. Not stored on our servers."
                  required
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls(errors.email)}
                  />
                </Field>
              </fieldset>

              <Button
                type="submit"
                size="lg"
                className="w-full text-lg py-7 rounded-full bg-white text-slate-950 hover:bg-zinc-100 font-semibold mt-2"
              >
                Continue to Upload ID →
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper components
function Field({
  label, children, error, hint, required, className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-zinc-300 mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function inputCls(error?: string) {
  return `bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-teal-500
    ${error ? 'border-red-500' : ''}`;
}

function selectCls(error?: string) {
  return `bg-zinc-950 border-zinc-700 text-white
    ${error ? 'border-red-500' : ''}`;
}