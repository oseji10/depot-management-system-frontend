"use client";

import { useState } from "react";
import { useOptions } from "../hooks/options";
import { ImportModal } from "./import-modal";
import { Button, SelectField, Svg } from "./ui";

const UPLOAD = "M12 16V4m0 0-4 4m4-4 4 4M4 20h16";

export function ImportCustomersButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Svg d={UPLOAD} /> Bulk upload</Button>
      {open && (
        <ImportModal
          title="Upload customers" endpoint="/imports/customers" extra={{}} batchSize={200} onClose={() => setOpen(false)}
          intro={<p>Upload your customer export (Excel). Name, phone, email, address and the <em>Group / Route</em> column are read; a group is created for each route and the customer is put in it. Customers already here (same phone number, or imported before) are left as they are, so it is safe to upload the same file again.</p>}
          columns={[
            { name: "Customer ID" }, { name: "Name", required: true }, { name: "First Name" }, { name: "Last Name" }, { name: "Phone" }, { name: "Email" },
            { name: "Street" }, { name: "City" }, { name: "State" }, { name: "Group / Route" }, { name: "Created", date: true },
          ]}
          labels={{ customers_created: "new customers added", customers_existing: "already here (left unchanged)", grouped: "placed in a group", skipped_walk_in: "walk-in placeholders skipped" }}
        />
      )}
    </>
  );
}

export function ImportProductsButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const categories = useOptions("/product-categories");
  const units = useOptions("/units");
  const warehouses = useOptions("/warehouses");

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Svg d={UPLOAD} /> Bulk upload</Button>
      {open && (
        <ImportModal
          title="Upload products" endpoint="/imports/products" onClose={() => setOpen(false)}
          extra={category ? { category_id: Number(category), base_unit_id: unit ? Number(unit) : null, warehouse_id: warehouse ? Number(warehouse) : null } : null}
          intro={<p>Upload your product export (Excel). Each new product gets the category below and its price in your standard price list. What it is counted in comes from a "Unit" column if your file has one, otherwise from the name (RGB = Bottle, PET = Plastic bottle, CAN = Can). Products you already have (same code or same name) are skipped. Stock counts are <strong>not</strong> added directly: they become one opening-stock adjustment waiting for approval.</p>}
          columns={[{ name: "Product ID" }, { name: "Name", required: true }, { name: "Price" }, { name: "Cost" }, { name: "Stock Qty" }, { name: "Unit" }]}
          options={
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label="Category for new products" value={category} onChange={setCategory} options={[{ value: "", label: "Choose…" }, ...categories]} hint="Move them to the right category afterwards." />
              <SelectField label="Counted in, when it is not clear" value={unit} onChange={setUnit} options={[{ value: "", label: "Bottle" }, ...units]} hint="Used only for products whose name does not say bottle, plastic bottle or can, and that have no Unit column." />
              <SelectField label="Opening stock goes to" value={warehouse} onChange={setWarehouse} options={[{ value: "", label: "Don't add stock" }, ...warehouses]} />
            </div>
          }
          labels={{ created: "products added", existing: "already here (skipped)", prices_added: "missing prices filled in", without_price: "added without a price (set one before selling)", opening_lines: "products in the opening-stock adjustment", cost_guessed: "of those had no cost, so their price was used as cost" }}
        />
      )}
    </>
  );
}

export function ImportOrdersButton() {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState("");
  const branches = useOptions("/branches");

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Svg d={UPLOAD} /> Bulk upload</Button>
      {open && (
        <ImportModal
          title="Upload past orders" endpoint="/imports/orders" batchSize={100} onClose={() => setOpen(false)}
          extra={branch ? { branch_id: Number(branch) } : null}
          intro={
            <div className="space-y-2">
              <p>Upload your order export (Excel) to bring in sales history. Upload <strong>products first</strong> (and customers, if you have that file) so each order can be tied to them.</p>
              <p>Imported orders are history only: they show in Sales, customer insights and sales reports, but they <strong>do not change stock and are not posted to the books</strong>. Cancelled and returned orders come in as voided. If an order was paid by two methods, the first method gets the whole amount. Uploading the same file again adds nothing twice.</p>
            </div>
          }
          columns={[
            { name: "Order #", required: true }, { name: "Order ID", required: true }, { name: "Order Date", required: true, date: true }, { name: "Customer ID" }, { name: "Customer" },
            { name: "Phone" }, { name: "Channel" }, { name: "Status" }, { name: "Shipping Status" }, { name: "Items" }, { name: "Subtotal" }, { name: "Total", required: true },
            { name: "Amount Paid" }, { name: "Amount Due" }, { name: "Payment Method" }, { name: "Created By" }, { name: "Note" },
          ]}
          options={<SelectField label="Branch these orders belong to" value={branch} onChange={setBranch} options={[{ value: "", label: "Choose…" }, ...branches]} />}
          labels={{ created: "orders added", created_void: "cancelled or returned orders added as voided", existing: "already imported (skipped)", lines: "order lines added", lines_skipped: "order lines left off (product not found)", customers_created: "customers created from orders", customers_existing: "orders matched to existing customers" }}
        />
      )}
    </>
  );
}
