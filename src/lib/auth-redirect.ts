export function buildHashRouteUrl(origin: string, baseUrl: string, route: string): string {
  const cleanOrigin = origin.replace(/\/$/, '')
  const cleanBase = `/${baseUrl.replace(/^\/+|\/+$/g, '')}/`
  const cleanRoute = route.replace(/^\/+/, '')
  return `${cleanOrigin}${cleanBase}#/${cleanRoute}`
}

export function getAuthRedirectUrl(route: string): string {
  return buildHashRouteUrl(window.location.origin, import.meta.env.BASE_URL, route)
}
