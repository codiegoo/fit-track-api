'use client'
import React from "react";

/**
 * Fit‑Tracker — Mobile Mockups (ilustrativos, sin lógica)
 *
 * Objetivo: Renderizar **todas** las pantallas como mockups móviles (Android‑first)
 * una **debajo de la otra**, responsivas para verse bien en PC. Sin estado, sin API,
 * sin navegación real. Solo UI ilustrativa.
 *
 * Uso: copiar como `app/mobile-mockups/page.tsx` (Next.js App Router) o cualquier ruta.
 * Requiere Tailwind.
 */

// ===== Tokens de color (ligero toque Material) =====
const palette = {
  bg: "#0b0f14",
  card: "#111826",
  primary: "#1f6feb",
  primaryAlt: "#2a84ff",
  accent: "#22c55e",
  text: "#e5e7eb",
  sub: "#9ca3af",
  danger: "#ef4444",
};

// ===== Utils =====
function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-center text-sm font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </h2>
  );
}

// Marco de teléfono (Android‑ish)
const PhoneFrame: React.FC<{ children: React.ReactNode }>=({ children }) => (
  <div className="mx-auto w-full max-w-[420px] px-2">
    <div className="rounded-[36px] border border-zinc-700 bg-black shadow-2xl">
      <div className="relative m-3 rounded-[30px]" style={{ background: palette.bg }}>
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-zinc-400">
          <span>9:41</span>
          <div className="flex gap-1"><span>📶</span><span>📡</span><span>🔋</span></div>
        </div>
        <div className="h-[760px] overflow-hidden rounded-[26px] border border-zinc-800">
          {children}
        </div>
      </div>
    </div>
  </div>
);

// Header simple
function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-5 pb-4 pt-5" style={{ background: "linear-gradient(180deg, rgba(31,111,235,0.14), transparent)" }}>
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-[13px] text-zinc-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// Campo visual (sin inputs reales)
function MockField({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-zinc-400">{label}</p>
      <div className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-[15px] text-zinc-500">
        {hint || ""}
      </div>
    </div>
  );
}

function MockBtn({ text, variant = "primary" as const }: { text: string; variant?: "primary"|"ghost"|"danger"|"accent" }) {
  const base = "w-full rounded-2xl px-4 py-3 text-center text-[15px] font-medium";
  const map = {
    primary: `bg-[${palette.primary}] text-white`,
    ghost: "border border-zinc-700 text-zinc-200",
    danger: `bg-[${palette.danger}] text-white`,
    accent: `bg-[${palette.accent}] text-black`,
  } as const;
  return <div className={`${base} ${map[variant]}`}>{text}</div>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-[12px] text-zinc-300">{children}</span>;
}

// ======== PANTALLAS (ilustrativas) ========
function ScreenLogin() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Fit‑Tracker" subtitle="Bienvenido de vuelta" />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <MockField label="Email" hint="tu@correo.com" />
        <MockField label="Password" hint="••••••••" />
        <MockBtn text="Iniciar sesión" />
        <div className="text-center text-sm text-sky-400">Crear cuenta</div>
      </div>
    </div>
  );
}

function ScreenRegister() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Crear cuenta" subtitle="Bienvenido" />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <MockField label="Nombre" hint="Tu nombre" />
        <MockField label="Email" hint="tu@correo.com" />
        <MockField label="Password" hint="••••••••" />
        <MockBtn text="Registrarme" />
        <div className="text-center text-sm text-sky-400">Ya tengo cuenta</div>
      </div>
    </div>
  );
}

function ScreenHome() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Hola, Usuario" subtitle="miércoles, Oct 15" right={<Chip>🔥 5‑day streak</Chip>} />
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Hoy</h3>
          <div className="grid grid-cols-2 gap-3">
            {["Desayuno","Comida","Cena","Snack"].map((m,i)=> (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-[12px] text-zinc-400">{m}</p>
                <div className="mt-2 h-28 rounded-xl bg-zinc-800/60" />
                <p className="mt-2 text-[12px] text-zinc-500">Añade foto y nota</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-[--pri] p-4 text-2xl text-white shadow-lg" style={{ ['--pri' as any]: palette.primary }}>+</div>
      <nav className="sticky bottom-0 flex justify-around border-t border-zinc-800 bg-[#0b0f14]/95 py-2 backdrop-blur">
        {["Inicio","Nuevo","Rachas","Perfil"].map((t,i)=> (
          <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[12px] text-zinc-400">
            <span className="text-lg leading-none">{["🏠","➕","🔥","👤"][i]}</span>
            <span>{t}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

function ScreenAddRecord() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Nuevo registro" subtitle="Añade tu comida" />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-24">
        <div className="aspect-[4/3] w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40" />
        <div className="grid grid-cols-4 gap-2 text-[12px]">
          {["Desayuno","Comida","Cena","Snack"].map((t,i)=>(
            <div key={i} className="rounded-xl border border-zinc-700 px-3 py-2 text-center text-zinc-300">{t}</div>
          ))}
        </div>
        <MockField label="Nota" hint="¿Qué comiste?" />
      </div>
      <div className="sticky bottom-0 flex gap-3 bg-[--bg] px-5 pb-5 pt-3" style={{ ['--bg' as any]: palette.bg }}>
        <div className="w-full rounded-2xl border border-zinc-700 px-4 py-3 text-center text-[15px] text-zinc-200">Cancelar</div>
        <MockBtn text="Guardar" />
      </div>
    </div>
  );
}

function ScreenStreaks() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Rachas" subtitle="¡Sigue así!" />
      <div className="grid flex-1 grid-cols-2 gap-3 px-5 pb-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-400">Actual</p>
          <p className="mt-1 text-4xl font-semibold text-white">5</p>
          <p className="mt-2 text-[12px] text-zinc-500">días seguidos</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-400">Máxima</p>
          <p className="mt-1 text-4xl font-semibold text-white">12</p>
          <p className="mt-2 text-[12px] text-zinc-500">mejor racha</p>
        </div>
      </div>
    </div>
  );
}

function ScreenProfile() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: palette.bg }}>
      <Header title="Perfil" subtitle="Preferencias" />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600" />
          <div>
            <p className="text-[15px] text-white">Usuario</p>
            <p className="text-[12px] text-zinc-400">America/Mazatlan</p>
          </div>
        </div>
        <hr className="border-zinc-800" />
        <div className="flex items-center justify-between text-[15px] text-zinc-200">
          <span>Notificaciones</span>
          <div className="h-5 w-10 rounded-full bg-zinc-700"><div className="h-5 w-5 translate-x-5 rounded-full bg-white"/></div>
        </div>
        <MockField label="Nombre" hint="Nombre de usuario" />
        <MockField label="Zona horaria" hint="America/Mazatlan" />
        <MockBtn text="Guardar cambios" />
      </div>
    </div>
  );
}

// ===== Página: todas las pantallas apiladas y responsivas =====
export default function MobileMockupsPage() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0b0f14] to-black px-4 py-8 text-zinc-100 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <h1 className="text-center text-2xl font-semibold">Fit‑Tracker — Mockups móviles (ilustrativos)</h1>
        <p className="mt-1 text-center text-sm text-zinc-400">Sin lógica ni API. Solo diseño. Android‑first. Centrado y responsive.</p>

        <SecTitle>Login</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenLogin /></PhoneFrame>
        </div>

        <SecTitle>Register</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenRegister /></PhoneFrame>
        </div>

        <SecTitle>Home</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenHome /></PhoneFrame>
        </div>

        <SecTitle>Nuevo registro</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenAddRecord /></PhoneFrame>
        </div>

        <SecTitle>Rachas</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenStreaks /></PhoneFrame>
        </div>

        <SecTitle>Perfil</SecTitle>
        <div className="flex w-full justify-center">
          <PhoneFrame><ScreenProfile /></PhoneFrame>
        </div>

        <footer className="mt-10 text-center text-xs text-zinc-500">
          UI demo estática. Ajusta colores, tipografías o espaciados a tu gusto.
        </footer>
      </div>
    </main>
  );
}
