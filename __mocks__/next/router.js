// Manual mock for next/router: the real module's exports throw "No router
// instance found" when touched outside the browser, which breaks Jest's
// automock introspection.
const router = {
  push: jest.fn().mockResolvedValue(true),
  replace: jest.fn().mockResolvedValue(true),
  prefetch: jest.fn().mockResolvedValue(undefined),
  back: jest.fn(),
  reload: jest.fn(),
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
};

module.exports = {
  __esModule: true,
  default: router,
  useRouter: jest.fn(() => router),
  withRouter: component => component,
  Router: router,
};
