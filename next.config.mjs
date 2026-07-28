/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Phones on the local network reach the dev server by IP rather than
  // localhost, which Next treats as a cross-origin request. Dev only —
  // this has no effect on a production build.
  //
  // If the PC's LAN address changes, add the new one here or set a
  // static DHCP lease on the router.
  allowedDevOrigins: ["192.168.18.236"],
};

export default nextConfig;
