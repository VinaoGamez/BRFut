/** URLs dos logos de patrocinadores — módulo único (evita glob duplicado no bundle). */
export const SPONSOR_LOGO_URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/sponsors/icons/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => {
    const file = path.split('/').pop()?.replace(/\.png$/i, '') || '';
    return [file, url];
  }),
);

export function sponsorLogoUrl(slug) {
  return slug ? SPONSOR_LOGO_URLS[slug] || null : null;
}
