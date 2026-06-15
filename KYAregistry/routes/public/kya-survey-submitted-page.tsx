export default function PublicKyaSurveySubmittedPage() {
  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16 md:px-10">
        <p className="tape-eyebrow">Xupra KYA Registry</p>
        <section className="tape-panel bg-white p-6">
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            Survey submitted
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-700">
            Xupra received the KYA controls survey. The submission is private until review is complete and a certificate is approved.
          </p>
        </section>
      </div>
    </main>
  );
}
