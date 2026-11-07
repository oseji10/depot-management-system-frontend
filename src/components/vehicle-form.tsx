"use client";

import { Field, SelectField } from "./ui";
import { useOptions } from "../hooks/options";
import { FUEL_TYPES, VEHICLE_TYPES } from "../lib/vehicles";

export function VehicleFormFields({ f, set }: { f: Record<string, string>; set: (k: string) => (v: string) => void }) {
  const branches = useOptions("/branches");
  const users = useOptions("/users");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Registration (plate) number" value={f.reg_no} onChange={(e) => set("reg_no")(e.target.value.toUpperCase())} required autoFocus />
      <Field label="Nickname (optional)" value={f.nickname} onChange={(e) => set("nickname")(e.target.value)} placeholder="e.g. Big Blue" />
      <SelectField label="Type" value={f.type} onChange={set("type")} options={Object.entries(VEHICLE_TYPES).map(([value, label]) => ({ value, label }))} />
      <SelectField label="Fuel" value={f.fuel_type} onChange={set("fuel_type")} options={Object.entries(FUEL_TYPES).map(([value, label]) => ({ value, label }))} />
      <Field label="Make" value={f.make} onChange={(e) => set("make")(e.target.value)} placeholder="e.g. Mack" />
      <Field label="Model" value={f.model} onChange={(e) => set("model")(e.target.value)} />
      <Field label="Year" inputMode="numeric" value={f.year} onChange={(e) => set("year")(e.target.value.replace(/\D/g, ""))} />
      <Field label="Colour" value={f.color} onChange={(e) => set("color")(e.target.value)} />
      <Field label="Capacity (crates)" inputMode="numeric" value={f.capacity_crates} onChange={(e) => set("capacity_crates")(e.target.value.replace(/\D/g, ""))} />
      <Field label="Odometer (km)" inputMode="numeric" value={f.odometer} onChange={(e) => set("odometer")(e.target.value.replace(/\D/g, ""))} />
      <Field label="Chassis number" value={f.chassis_no} onChange={(e) => set("chassis_no")(e.target.value)} />
      <Field label="Engine number" value={f.engine_no} onChange={(e) => set("engine_no")(e.target.value)} />
      <SelectField label="Branch" value={f.branch_id} onChange={set("branch_id")} options={[{ value: "", label: "Choose a branch" }, ...branches]} required />
      <SelectField label="Usual driver (optional)" value={f.default_driver_id} onChange={set("default_driver_id")} options={[{ value: "", label: "None" }, ...users]} />
    </div>
  );
}

export function vehicleBody(f: Record<string, string>) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return {
    reg_no: f.reg_no, nickname: f.nickname || null, type: f.type, fuel_type: f.fuel_type, make: f.make || null, model: f.model || null, year: num(f.year),
    color: f.color || null, capacity_crates: num(f.capacity_crates), odometer: num(f.odometer), chassis_no: f.chassis_no || null, engine_no: f.engine_no || null,
    branch_id: num(f.branch_id), default_driver_id: num(f.default_driver_id),
  };
}

