import Container from "@/components/shared/Container";
import Link from "next/link";
import { Globe, PoundSterling } from "lucide-react";
import { FaLinkedinIn, FaTiktok, FaInstagram, FaFacebookF, FaXTwitter } from "react-icons/fa6";

export default function SiteFooter() {
  return (
    <footer className="bg-brand-700 text-brand-50">
      {/* --- Social / utility bar --- */}
      <div className="border-b border-brand-600">
        <Container className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4">
          {/* Social icons */}
          <div className="flex items-center gap-4 text-xl">
            <Link href="#" aria-label="LinkedIn"><FaLinkedinIn /></Link>
            <Link href="#" aria-label="TikTok"><FaTiktok /></Link>
            <Link href="#" aria-label="Instagram"><FaInstagram /></Link>
            <Link href="#" aria-label="Facebook"><FaFacebookF /></Link>
            <Link href="#" aria-label="X (Twitter)"><FaXTwitter /></Link>
          </div>

          {/* Language & Currency */}
          <div className="flex items-center gap-6 text-sm">
            <button className="flex items-center gap-2 hover:underline">
              <Globe className="h-4 w-4" /> English
            </button>
            <button className="flex items-center gap-2 hover:underline">
              <PoundSterling className="h-4 w-4" /> GBP
            </button>
          </div>
        </Container>
      </div>

      {/* --- Main link grid --- */}
      <Container className="py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Column 1 */}
          <div>
            <h4 className="text-sm font-semibold">Skilink</h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-100">
              <li><Link href="#">Skilink Pro</Link></li>
              <li><Link href="#">Partnerships</Link></li>
              <li><Link href="#">Become a Provider</Link></li>
              <li><Link href="#">Advertising</Link></li>
              <li><Link href="#">Careers</Link></li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="text-sm font-semibold">Resources</h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-100">
              <li><Link href="#">Skilink Guide</Link></li>
              <li><Link href="#">Invite a Friend</Link></li>
              <li><Link href="#">Help & Support</Link></li>
              <li><Link href="#">Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-100">
              <li><Link href="#">Privacy Policy</Link></li>
              <li><Link href="#">Cookies Notice</Link></li>
              <li><Link href="#">Terms & Conditions</Link></li>
              <li><Link href="#">Interest-Based App Notice</Link></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-100">
              <li><Link href="#">About Skilink</Link></li>
              <li><Link href="#">Press</Link></li>
              <li><Link href="#">Blog</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-10 border-t border-brand-600 pt-6 text-xs text-brand-200 text-center sm:text-left">
          © {new Date().getFullYear()} Skilink · All rights reserved
        </div>
      </Container>
    </footer>
  );
}
