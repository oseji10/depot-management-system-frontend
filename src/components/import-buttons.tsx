"use client";

import { useState } from "react";
import { useOptions } from "../hooks/options";
import { downloadTemplate } from "../lib/spreadsheet";
import { ImportModal } from "./import-modal";
import { Button, SelectField, Svg } from "./ui";

const UPLOAD = "M12 16V4m0 0-4 4m4-4 4 4M4 20h16";
const DOWNLOAD = "M12 4v12m0 0-4-4m4 4 4-4M4 20h16";

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

const PRODUCT_COLUMNS = ["Product ID", "Name", "Category", "Packaging", "Unit"];

export function ImportProductsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Svg d={UPLOAD} /> Bulk upload</Button>
      {open && (
        <ImportModal
          title="Upload products" endpoint="/imports/products" onClose={() => setOpen(false)}
          extra={{}}
          intro={
            <div className="space-y-2">
              <p>Fill in the template (or upload your own export with the same column names) and choose the file. Only <strong>Name</strong> is required. A new <strong>Category</strong> in the file is created for you; products without one go into &ldquo;General&rdquo;. <strong>Packaging</strong> is RGB, PET, Can or Other. Products you already have (same Product ID or same name) are skipped.</p>
              <p>Only the products are added: no stock and no prices. Set prices on the Price lists page, and bring stock in with a goods receipt or a stock count.</p>
              <Button type="button" variant="secondary" onClick={() => void downloadTemplate("product-upload-template.xlsx", PRODUCT_COLUMNS, [
                ["COKE50", "Coke 50cl", "Soft drinks", "RGB", "Crate"],
                ["", "Eva Water 75cl", "Water", "PET", "Pack"],
              ])}>
                <Svg d={DOWNLOAD} /> Download template
              </Button>
            </div>
          }
          columns={[{ name: "Product ID" }, { name: "Name", required: true }, { name: "Category" }, { name: "Packaging" }, { name: "Unit" }]}
          labels={{ created: "products added", existing: "already here (skipped)" }}
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
