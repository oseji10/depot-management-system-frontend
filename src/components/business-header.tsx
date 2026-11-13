"use client";

import Link from "next/link";
import { useSession } from "../hooks/session";
import { useProductImage } from "./product-image";

/**
 * Logo, business name, address and phone, centred, for the top of a printed receipt or voucher.
 * Whatever is missing on the My business page is left out of the print, and a note on screen (not printed) says what to add.
 */
export function BusinessHeader({ onLogoSettled, branch }: { onLogoSettled?: () => void; branch?: string | null }) {
  const { store, can } = useSession();
  const logoUrl = store?.logo_url ?? null;
  const logo = useProductImage(logoUrl);
  const missing = [!logoUrl && "logo", !store?.phone && "phone number"].filter(Boolean) as string[];

  return (
    <div className="text-center">
      {logoUrl && logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={store?.name ?? ""} onLoad={onLogoSettled} onError={onLogoSettled} className="mx-auto mb-2 max-h-20 max-w-[70%] object-contain print:max-h-[18mm] print:max-w-[56mm]" />
      )}
      <p className="text-lg font-black tracking-tight">{store?.name}</p>
      {store?.address && <p className="text-xs">{store.address}</p>}
      {store?.phone && <p className="text-xs font-semibold">Tel: {store.phone}</p>}
      {store?.email && <p className="text-xs font-semibold">Email: {store.email}</p>}
      {branch && <p className="text-xs">{branch}</p>}
      {missing.length > 0 && can("business.manage") && (
        <p className="mt-1 text-[11px] text-amber-700 print:hidden">Your {missing.join(" and ")} will print here once added. <Link href="/business" className="font-semibold underline">Add it</Link></p>
      )}
    </div>
  );
}
