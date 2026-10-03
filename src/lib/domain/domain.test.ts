import { describe, expect, it } from "vitest";
import { applyChange, isResolved, progress } from "./checklist";
import { noticeRecipients, nextToSign, readyForFinalNotice } from "./signing";
import { parseChecklistRows } from "./importer";

describe("checklist", () => {
  it("resuelto solo sin pendientes ni rechazados", () => {
    expect(isResolved([{ status: "accepted" }, { status: "not_applicable" }])).toBe(true);
    expect(isResolved([{ status: "accepted" }, { status: "pending" }])).toBe(false);
    expect(isResolved([{ status: "rejected" }])).toBe(false);
  });

  it("calcula avance", () => {
    expect(progress([{ status: "accepted" }, { status: "pending" }])).toBe(50);
    expect(progress([])).toBe(0);
  });

  it("registra historial aunque el estado final sea Aceptado", () => {
    const base = { status: "pending" as const, observation: "" };
    const a = applyChange(base, { userId: "u1", cargo: "ITO", status: "rejected", observation: "grieta" });
    const b = applyChange(a.item, { userId: "u2", cargo: "Jefe de Terreno", status: "accepted" });
    expect(a.event?.cargo).toBe("ITO");
    expect(b.event?.status).toBe("accepted");
    expect(b.item.observation).toBe("grieta");
  });

  it("no genera evento si nada cambió", () => {
    const item = { status: "accepted" as const, observation: "ok" };
    expect(applyChange(item, { userId: "u", cargo: "x", status: "accepted" }).event).toBeNull();
  });
});

describe("firmas y aviso al ITO", () => {
  const roles = ["Supervisor Subcontrato", "Supervisor Alborada", "Jefe de Terreno", "Control de Calidad", "ITO"];
  const ok = [{ status: "accepted" as const }];

  it("respeta el orden de firma", () => {
    expect(nextToSign(roles, ["Supervisor Subcontrato"])).toBe("Supervisor Alborada");
    expect(nextToSign(roles, roles)).toBeNull();
  });

  it("avisa solo cuando los previos firmaron y no hay pendientes", () => {
    const prev = roles.slice(0, -1);
    expect(readyForFinalNotice(roles, prev, ok)).toBe(true);
    expect(readyForFinalNotice(roles, prev.slice(1), ok)).toBe(false);
    expect(readyForFinalNotice(roles, prev, [{ status: "pending" }])).toBe(false);
    expect(readyForFinalNotice(roles, roles, ok)).toBe(false); // ITO ya firmó
  });

  it("Para = último cargo, CC = intermedios marcados con correo", () => {
    const r = noticeRecipients([
      { cargo: "Supervisor", ccOnNotice: false, email: "s@x.cl" },
      { cargo: "Jefe de Terreno", ccOnNotice: true, email: "jt@x.cl" },
      { cargo: "Control de Calidad", ccOnNotice: true, email: null },
      { cargo: "ITO", ccOnNotice: false, email: "ito@x.cl" },
    ]);
    expect(r).toEqual({ to: "ito@x.cl", cc: ["jt@x.cl"] });
  });
});

describe("importador", () => {
  it("detecta columnas en cualquier posición", () => {
    const rows = [
      ["Proyecto X"],
      [null, "Equipo", "Partidas a controlar", "Documento"],
      [null, "Nivel", "Verificar plomo de tabiques", "PE-01"],
      [null, "", "", ""],
    ];
    expect(parseChecklistRows(rows)).toEqual([
      { description: "Verificar plomo de tabiques", document: "PE-01", team: "Nivel" },
    ]);
  });

  it("falla con mensaje claro si no hay encabezado", () => {
    expect(() => parseChecklistRows([["a", "b"]])).toThrow(/Partidas a controlar/);
  });
});

import { leavesNoAdmin } from "./members";

describe("miembros", () => {
  const members = [
    { userId: "a", isAdmin: true },
    { userId: "b", isAdmin: false },
  ];
  it("no permite quitar ni degradar al último administrador", () => {
    expect(leavesNoAdmin(members, "a", { remove: true })).toBe(true);
    expect(leavesNoAdmin(members, "a", { isAdmin: false })).toBe(true);
  });
  it("permite cambios que dejan algún administrador", () => {
    expect(leavesNoAdmin(members, "b", { remove: true })).toBe(false);
    expect(leavesNoAdmin(members, "a", { isAdmin: true })).toBe(false);
    expect(leavesNoAdmin([...members, { userId: "c", isAdmin: true }], "a", { remove: true })).toBe(false);
  });
});

import { inkOn, safeBrand, DEFAULT_BRAND } from "../brand";

describe("marca", () => {
  it("valida el color y cae al predeterminado", () => {
    expect(safeBrand("#ff0000")).toBe("#ff0000");
    expect(safeBrand("red; background:url(x)")).toBe(DEFAULT_BRAND);
    expect(safeBrand(null)).toBe(DEFAULT_BRAND);
  });
  it("elige texto legible", () => {
    expect(inkOn("#1f4e79")).toBe("#ffffff");
    expect(inkOn("#ffe066")).toBe("#111827");
  });
});

import { parseLegacyStorage, withCc, normCargo } from "./legacy";

describe("importador de la versión anterior", () => {
  const project = JSON.stringify({
    obra: "Obra Demo",
    edificios: [{ id: "a", nombre: "Torre A", pisos: 11, deptosPorPiso: 8 }],
    usuarios: [{ usuario: "x", passwordHash: "secreto" }],
  });
  const partidas = JSON.stringify([
    { codigo: "TM-02", nombre: "Trazado", titulo: "PROTOCOLO X", roles: ["SUPERVISOR  SUBCONTRATO", "JEFE DE TERRENO", "CONTROL DE CALIDAD", "ITO"],
      items: [{ id: "TM-02-01", texto: "VERIFICAR", doc: "Planos", equipo: "Huincha" }, { id: "TM-02-02", texto: "" }] },
  ]);

  it("extrae obra, edificios y partidas sin usuarios ni hashes", () => {
    const cfg = parseLegacyStorage([["config:project", project], ["config:partidas", partidas], ["registro:TM-02:a:101", "{}"]]);
    expect(cfg.obra).toBe("Obra Demo");
    expect(cfg.buildings).toEqual([{ name: "Torre A", floors: 11, unitsPerFloor: 8 }]);
    expect(cfg.partidas[0].items).toEqual([{ code: "TM-02-01", description: "VERIFICAR", document: "Planos", team: "Huincha" }]);
    expect(cfg.recordCount).toBe(1);
    expect(JSON.stringify(cfg)).not.toContain("secreto");
  });

  it("normaliza cargos y pone en copia a Jefe de Terreno y Control de Calidad (salvo el último)", () => {
    expect(normCargo("SUPERVISOR  SUBCONTRATO ")).toBe("SUPERVISOR SUBCONTRATO");
    expect(withCc(["SUPERVISOR  X", "JEFE DE TERRENO", "CONTROL DE CALIDAD", "ITO"]).map((r) => r.cc)).toEqual([false, true, true, false]);
    expect(withCc(["JEFE DE TERRENO"])[0].cc).toBe(false);
  });

  it("falla con mensajes claros", () => {
    expect(() => parseLegacyStorage([])).toThrow(/config:project/);
    expect(() => parseLegacyStorage([["config:project", "{"], ["config:partidas", "[]"]])).toThrow(/formato/);
  });
});

import { cellState, cargoKey, nextSigner, unitLabel } from "./protocol";

describe("protocolo en terreno", () => {
  const roles = ["SUPERVISOR", "JEFE DE TERRENO", "ITO"];
  it("numera los deptos como en obra", () => {
    expect(unitLabel(9, 4)).toBe("904");
    expect(unitLabel(11, 8)).toBe("1108");
    expect(unitLabel(1, 1)).toBe("101");
  });
  it("compara cargos sin importar espacios ni mayúsculas", () => {
    expect(cargoKey(" Supervisor  Subcontrato ")).toBe("SUPERVISOR SUBCONTRATO");
  });
  it("calcula el estado del registro", () => {
    expect(cellState(null, roles, [])).toBe("none");
    expect(cellState([{ status: "pending" }], roles, [])).toBe("progress");
    expect(cellState([{ status: "accepted" }, { status: "rejected" }], roles, [])).toBe("rejected");
    expect(cellState([{ status: "accepted" }, { status: "not_applicable" }], roles, ["SUPERVISOR"])).toBe("resolved");
    expect(cellState([{ status: "rejected" }], roles, ["ito"])).toBe("closed");
  });
  it("indica quién firma ahora", () => {
    expect(nextSigner(roles, [])).toBe("SUPERVISOR");
    expect(nextSigner(roles, ["supervisor", "JEFE DE TERRENO"])).toBe("ITO");
    expect(nextSigner(roles, roles)).toBeNull();
  });
});
