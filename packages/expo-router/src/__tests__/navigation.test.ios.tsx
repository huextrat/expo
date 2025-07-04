/* eslint-disable react-hooks/rules-of-hooks */
import React, { Text, View } from 'react-native';

import {
  useRouter,
  useGlobalSearchParams,
  router,
  useLocalSearchParams,
  Redirect,
  Slot,
  usePathname,
  Link,
} from '../exports';
import { Stack } from '../layouts/Stack';
import { Tabs } from '../layouts/Tabs';
import { act, fireEvent, renderRouter, screen } from '../testing-library';

it('should respect `unstable_settings', () => {
  const render = (options: any = {}) =>
    renderRouter(
      {
        '(one,two)/_layout': {
          unstable_settings: {
            initialRouteName: 'apple',
            two: {
              initialRouteName: 'orange',
            },
          },
          default: () => <Tabs />,
        },
        '(one,two)/apple': () => <Text testID="apple"> Apple</Text>,
        '(two)/banana': () => <Text testID="banana">Banana</Text>,
        '(one,two)/orange': () => <Text testID="orange">Orange</Text>,
      },
      options
    );

  render({ initialUrl: '/orange' });
  expect(screen).toHaveSegments(['(two)', 'orange']);

  expect(screen.getByTestId('orange')).toBeVisible();
  // Orange is the initial route so you can't go back
  expect(router.canGoBack()).toBeFalsy();

  // Reset the app, but start at /banana
  screen.unmount();
  render({ initialUrl: '/banana' });

  expect(screen.getByTestId('banana')).toBeVisible();
  // Orange should be the initialRouteName, because we are in (two)
  act(() => router.back());
  expect(screen.getByTestId('orange')).toBeVisible();
});

it('can skip initialRouteName', () => {
  renderRouter({
    index: () => <Text testID="index">Index</Text>,
    '(stack)/_layout': {
      unstable_settings: {
        initialRouteName: 'apple',
      },
      default: () => <Stack />,
    },
    '(stack)/apple': () => <Text testID="apple">Apple</Text>,
    '(stack)/banana': () => <Text testID="banana">Banana</Text>,
  });

  expect(screen.getByTestId('index')).toBeVisible();
  act(() => router.push('/banana'));
  expect(screen.getByTestId('banana')).toBeVisible();
  act(() => router.back());
  expect(screen.getByTestId('index')).toBeVisible();

  act(() => router.push('/banana', { withAnchor: true }));
  expect(screen.getByTestId('banana')).toBeVisible();
  act(() => router.back());
  expect(screen.getByTestId('apple')).toBeVisible();

  act(() => router.replace('/'));

  act(() => router.push('/banana', { withAnchor: false }));
  expect(screen.getByTestId('banana')).toBeVisible();
  act(() => router.back());
  expect(screen.getByTestId('index')).toBeVisible();
});

describe('hooks only', () => {
  it('can handle navigation between routes', async () => {
    renderRouter({
      index: function MyIndexRoute() {
        const router = useRouter();

        return (
          <Text testID="index" onPress={() => router.push('/profile/test-name')}>
            Press me
          </Text>
        );
      },
      '/profile/[name]': function MyRoute() {
        const { name } = useGlobalSearchParams();
        return <Text>{name}</Text>;
      },
    });

    const text = await screen.findByTestId('index');

    act(() => {
      fireEvent.press(text);
    });

    expect(await screen.findByText('test-name')).toBeOnTheScreen();
    expect(screen).toHavePathname('/profile/test-name');
  });
});

describe('imperative only', () => {
  it('will throw if navigation is attempted before navigation is ready', async () => {
    renderRouter({
      index: function MyIndexRoute() {
        return <Text>Press me</Text>;
      },
      '/profile/[name]': function MyRoute() {
        const { name } = useGlobalSearchParams();
        return <Text>{name}</Text>;
      },
      '+native-intent': {
        redirectSystemPath() {
          return new Promise(() => {}); // This never resolves
        },
      },
    });

    expect(() => {
      act(() => {
        router.push('/profile/test-name');
      });
    }).toThrow(
      'Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.'
    );
  });

  it('can handle navigation between routes', async () => {
    renderRouter({
      index: function MyIndexRoute() {
        return <Text testID="index">Press me</Text>;
      },
      '/profile/[name]': function MyRoute() {
        const { name } = useGlobalSearchParams();
        return <Text>{name}</Text>;
      },
    });

    await screen.findByTestId('index');

    act(() => {
      router.push('/profile/test-name');
    });

    expect(await screen.findByText('test-name')).toBeOnTheScreen();
  });
  it('can handle navigation between routes with hashes', async () => {
    renderRouter({
      index: function MyIndexRoute() {
        return <Text testID="index">Press me</Text>;
      },
      '/profile/[name]': function MyRoute() {
        const { name } = useGlobalSearchParams();
        return <Text>{name}</Text>;
      },
    });

    await screen.findByTestId('index');

    act(() => {
      router.push('/profile/test-name?foo=bar#baz');
    });

    expect(await screen.findByText('test-name')).toBeOnTheScreen();
  });
});

describe('mixed navigation', () => {
  it('can handle mixed navigation between routes', async () => {
    renderRouter({
      index: function MyIndexRoute() {
        const router = useRouter();

        return (
          <Text testID="index" onPress={() => router.push('/profile/test-name')}>
            Press me
          </Text>
        );
      },
      '/profile/[name]': function MyRoute() {
        const { name } = useGlobalSearchParams();
        return <Text>{name}</Text>;
      },
    });

    const text = await screen.findByTestId('index');

    act(() => {
      fireEvent.press(text);
    });

    expect(await screen.findByText('test-name')).toBeOnTheScreen();

    act(() => {
      router.push('/profile/another-test-name');
    });

    expect(await screen.findByText('another-test-name')).toBeOnTheScreen();
  });
});

it('preserves history when replacing screens within the same navigator', () => {
  /* Modified repro of [#221](https://github.com/expo/router/issues/221). */

  renderRouter({
    index: () => <Text>home</Text>,
    two: () => <Text>two</Text>,
    permissions: () => <Text>permissions</Text>,
    protected: function Protected() {
      const params = useLocalSearchParams();

      if (!params.permissions) {
        return <Redirect href="/permissions" />;
      }

      return <Text>protected</Text>;
    },
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/two'));
  expect(screen).toHavePathname('/two');

  act(() => router.push('/protected'));
  // /protected should have a redirect that replaces the pathname
  expect(screen).toHavePathname('/permissions');

  act(() => router.back());
  expect(screen).toHavePathname('/two');

  // Can also replace via the imperative API
  act(() => router.replace('/permissions'));
  expect(screen).toHavePathname('/permissions');

  act(() => router.back());
  expect(screen).toHavePathname('/');
});

it('replaces from top level modal to initial route in a tab navigator', () => {
  /* Modified repro of [#221](https://github.com/expo/router/issues/221). */

  renderRouter({
    _layout: {
      unstable_settings: {
        // Ensure that reloading on `/modal` keeps a back button present.
        initialRouteName: '(tabs)',
      },
      default: () => <Stack />,
    },
    '[...missing]': () => <Text testID="missing">missing</Text>,
    '(tabs)/_layout': () => <Tabs />,
    '(tabs)/index': () => <Text testID="two">two</Text>,
  });

  expect(screen).toHavePathname('/');
  expect(screen).toHaveSegments(['(tabs)']);

  act(() => router.push('/missing-screen'));
  expect(screen).toHavePathname('/missing-screen');
  expect(screen).toHaveSegments(['[...missing]']);
  expect(screen.getByTestId('missing')).toBeOnTheScreen();

  act(() => router.push('/'));
  expect(screen).toHavePathname('/');
  expect(screen).toHaveSegments(['(tabs)']);
  expect(screen.getByTestId('two')).toBeOnTheScreen();

  // Ensure it also works for replace
  act(() => router.push('/missing-screen'));
  expect(screen).toHavePathname('/missing-screen');
  expect(screen).toHaveSegments(['[...missing]']);
  expect(screen.getByTestId('missing')).toBeOnTheScreen();

  act(() => router.replace('/'));
  expect(screen).toHavePathname('/');
  expect(screen).toHaveSegments(['(tabs)']);
  expect(screen.getByTestId('two')).toBeOnTheScreen();
});

it('pushes auto-encoded params and fully qualified URLs', () => {
  /** https://github.com/expo/router/issues/345 */
  renderRouter({
    index: () => <Text />,
    '[id]': () => <Text />,
  });

  expect(screen).toHavePathname('/');

  act(() =>
    router.push({
      pathname: '/abc',
      params: {
        one: 'hello?',
        two: 'https://localhost:8081/?foo=bar&one=more',
        three: ['one', 'two', 'three'],
      },
    })
  );
  expect(screen).toHavePathname('/abc');
  expect(screen).toHaveSearchParams({
    id: 'abc',
    one: 'hello?',
    two: 'https://localhost:8081/?foo=bar&one=more',
    three: 'one,two,three',
  });
});

it('does not loop infinitely when pushing a screen with empty options to an invalid initial route name', () => {
  /** https://github.com/expo/router/issues/452 */

  renderRouter({
    _layout: () => <Stack />,
    index: () => <Text />,
    'main/_layout': {
      unstable_settings: {
        // NOTE(EvanBacon): This has to be an invalid route.
        initialRouteName: 'index',
      },
      default: () => <Stack />,
    },
    'main/welcome': () => (
      <>
        <Stack.Screen options={{}} />
        <Text />
      </>
    ),
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/main/welcome'));
  expect(screen).toHavePathname('/main/welcome');
});

it('can push nested initial route name', () => {
  renderRouter({
    _layout: {
      unstable_settings: {
        // Should be able to push another stack even when this is set.
        initialRouteName: 'index',
      },
      default: () => <Stack />,
    },
    index: () => <Text />,
    'settings/_layout': () => <Slot />,
    'settings/index': () => <Text />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/settings'));
  expect(screen).toHavePathname('/settings');
});

it('can replace nested initial route name', () => {
  renderRouter({
    _layout: {
      unstable_settings: {
        // Should be able to push another stack even when this is set.
        initialRouteName: 'index',
      },
      default: () => <Stack />,
    },
    index: () => <Text />,
    'settings/_layout': () => <Slot />,
    'settings/index': () => <Text />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.replace('/settings'));
  expect(screen).toHavePathname('/settings');
});

it('can check goBack before navigation mounts', () => {
  renderRouter({
    _layout: {
      default() {
        // No navigator mounted at the root, this should prevent navigation from working.
        return <></>;
      },
    },
    index: () => <Text />,
  });

  expect(screen).toHavePathname('/');

  // NOTE: This also tests that `canGoBack` does not throw.
  expect(router.canGoBack()).toBe(false);
});

it('can push back from a nested modal to a nested sibling', async () => {
  renderRouter({
    _layout: () => (
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="slot" />
        <Stack.Screen name="(group)" options={{ presentation: 'modal' }} />
      </Stack>
    ),

    index: () => <Text />,

    'slot/_layout': () => <Slot />,
    'slot/index': () => <Text />,

    '(group)/_layout': () => <Slot />,
    '(group)/modal': () => <Text />,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');

  act(() => router.push('/(group)/modal'));
  expect(screen).toHavePathname('/modal');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');
});

it('can pop back from a nested modal to a nested sibling', async () => {
  renderRouter({
    _layout: () => (
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="slot" />
        <Stack.Screen name="(group)" options={{ presentation: 'modal' }} />
      </Stack>
    ),

    index: () => <Text />,

    'slot/_layout': () => <Slot />,
    'slot/index': () => <Text />,

    '(group)/_layout': () => <Slot />,
    '(group)/modal': () => <Text />,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');

  act(() => router.push('/(group)/modal'));
  expect(screen).toHavePathname('/modal');

  act(() => router.back());
  expect(screen).toHavePathname('/slot');
});

it('can navigate to hoisted groups', () => {
  /** https://github.com/expo/router/issues/805 */

  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/route': () => <Text testID="route" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/route'));

  expect(screen).toHavePathname('/example/route');
  expect(screen.getByTestId('route')).toBeTruthy();
});

it('can navigate to the index of a nested groups', () => {
  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/index': () => <Text testID="index" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/folder/(d)'));

  expect(screen).toHavePathname('/example/folder');
  expect(screen.getByTestId('index')).toBeTruthy();
});

it('can navigate to the first route of a nested group when there is not an index route', () => {
  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/route': () => <Text testID="route" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/folder/(d)/route'));

  expect(screen).toHavePathname('/example/folder/route');
  expect(screen.getByTestId('route')).toBeTruthy();
});

it('can navigate to the index of a hoisted nested groups', () => {
  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/index': () => <Text testID="index" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/folder/(d)'));

  expect(screen).toHavePathname('/example/folder');
  expect(screen.getByTestId('index')).toBeTruthy();
});

it('can navigate to the first route of a hoisted nested group when there is not an index route', () => {
  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/route': () => <Text testID="route" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/folder/(d)/route'));

  expect(screen).toHavePathname('/example/folder/route');
  expect(screen.getByTestId('route')).toBeTruthy();
});

it('can navigate to hoisted groups', () => {
  /** https://github.com/expo/router/issues/805 */

  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/route': () => <Text testID="route" />,
  });

  expect(screen).toHavePathname('/');
  act(() => router.push('/example/(a)/route'));

  expect(screen).toHavePathname('/example/route');
  expect(screen.getByTestId('route')).toBeTruthy();
});

it('can navigate to nested groups', () => {
  renderRouter({
    index: () => <></>,
    _layout: () => <Slot />,
    'example/(a,b)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/_layout': () => <Slot />,
    'example/(a,b)/folder/(c,d)/route': () => <Text testID="route" />,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/example/(a)/folder/(d)/route'));

  expect(screen).toHavePathname('/example/folder/route');
  expect(screen.getByTestId('route')).toBeTruthy();
});

it('can check goBack before navigation mounts', () => {
  renderRouter({
    _layout: {
      default() {
        // No navigator mounted at the root, this should prevent navigation from working.
        return <></>;
      },
    },
    index: () => <Text />,
  });

  expect(screen).toHavePathname('/');

  // NOTE: This also tests that `canGoBack` does not throw.
  expect(router.canGoBack()).toBe(false);
});

it('should stay within the same group', () => {
  renderRouter(
    {
      _layout: () => <Stack />,
      '(tabs)/_layout': () => <Tabs />,
      '(tabs)/(home)/_layout': () => <Stack />,
      '(tabs)/(home)/index': () => <Text testID="text">Home Index</Text>,
      '(tabs)/(home)/shared': () => <Text testID="text">Home Shared</Text>,
      '(tabs)/(profile)/_layout': () => <Stack />,
      '(tabs)/(profile)/index': () => <Text testID="text">Profile Index</Text>,
      '(tabs)/(profile)/shared': () => <Text testID="text">Profile Shared</Text>,
    },
    {
      initialUrl: '/(profile)',
    }
  );

  expect(screen).toHaveSegments(['(tabs)', '(profile)']);
  act(() => router.push('/shared'));
  expect(screen).toHaveSegments(['(tabs)', '(profile)', 'shared']);
});

it('should stay within the same group for hoisted routes', () => {
  renderRouter(
    {
      _layout: () => <Stack />,
      '(tabs)/_layout': () => <Tabs />,
      '(tabs)/(home)/_layout': () => <Stack />,
      '(tabs)/(home)/index': () => <Text testID="text">Home Index</Text>,
      '(tabs)/(home)/shared': () => <Text testID="text">Home Shared</Text>,
      // This is missing a layout, so the screens are hoisted
      '(tabs)/(profile)/index': () => <Text testID="text">Profile Index</Text>,
      '(tabs)/(profile)/shared': () => <Text testID="text">Profile Shared</Text>,
    },
    {
      initialUrl: '/(profile)',
    }
  );

  expect(screen).toHaveSegments(['(tabs)', '(profile)']);
  act(() => router.push('/shared'));
  expect(screen).toHaveSegments(['(tabs)', '(profile)', 'shared']);
});

it('should stay within the same group even if another group has more specific route', () => {
  renderRouter(
    {
      _layout: () => <Stack />,
      '(tabs)/_layout': () => <Tabs />,
      '(tabs)/(home)/_layout': () => <Stack />,
      '(tabs)/(home)/index': () => <Text testID="text">Home Index</Text>,
      // This is more specific (more segments)
      '(tabs)/(home)/(nested)/shared': () => <Text testID="text">Home Shared</Text>,
      '(tabs)/(profile)/_layout': () => <Stack />,
      '(tabs)/(profile)/index': () => <Text testID="text">Profile Index</Text>,
      '(tabs)/(profile)/shared': () => <Text testID="text">Profile Shared</Text>,
    },
    {
      initialUrl: '/(profile)',
    }
  );

  expect(screen).toHaveSegments(['(tabs)', '(profile)']);
  act(() => router.push('/shared'));
  expect(screen).toHaveSegments(['(tabs)', '(profile)', 'shared']);
});

it('can navigate back from a nested modal to a nested sibling', async () => {
  renderRouter({
    _layout: () => (
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="slot" />
        <Stack.Screen name="(group)" options={{ presentation: 'modal' }} />
      </Stack>
    ),

    index: () => <Text />,

    'slot/_layout': () => <Slot />,
    'slot/index': () => <Text />,

    '(group)/_layout': () => <Slot />,
    '(group)/modal': () => <Text />,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');

  act(() => router.push('/(group)/modal'));
  expect(screen).toHavePathname('/modal');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');

  // Ensure it also works fo replace

  act(() => router.push('/(group)/modal'));
  expect(screen).toHavePathname('/modal');

  act(() => router.replace('/slot'));
  expect(screen).toHavePathname('/slot');
});

it('can pop back from a nested modal to a nested sibling', async () => {
  renderRouter({
    _layout: () => (
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen name="slot" />
        <Stack.Screen name="(group)" options={{ presentation: 'modal' }} />
      </Stack>
    ),

    index: () => <Text />,

    'slot/_layout': () => <Slot />,
    'slot/index': () => <Text />,

    '(group)/_layout': () => <Slot />,
    '(group)/modal': () => <Text />,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/slot'));
  expect(screen).toHavePathname('/slot');

  act(() => router.push('/(group)/modal'));
  expect(screen).toHavePathname('/modal');

  act(() => router.back());
  expect(screen).toHavePathname('/slot');
});

it('supports multi-level 404s', async () => {
  renderRouter({
    index: () => <Text>found</Text>,
    '+not-found': () => <Text>404</Text>,
    'nested/+not-found': () => <Text>Nested 404</Text>,
  });

  expect(screen).toHavePathnameWithParams('/');
  expect(await screen.findByText('found')).toBeOnTheScreen();

  act(() => router.push('/123'));
  expect(await screen.findByText('404')).toBeOnTheScreen();
  expect(screen).toHavePathname('/123');
  expect(screen).toHaveSearchParams({
    'not-found': ['123'],
  });

  act(() => router.push('/123/456?test=true'));
  expect(await screen.findByText('404')).toBeOnTheScreen();
  // Should only have `test` and not include `not-found`
  expect(screen).toHavePathnameWithParams('/123/456?test=true');
  expect(screen).toHaveSearchParams({
    test: 'true',
    'not-found': ['123', '456'],
  });

  act(() => router.push('/nested/123?test=true'));
  expect(await screen.findByText('Nested 404')).toBeOnTheScreen();
  expect(screen).toHavePathnameWithParams('/nested/123?test=true');
  expect(screen).toHaveSearchParams({
    test: 'true',
    'not-found': ['123'],
  });

  act(() => router.push('/nested/123/456?test=true'));
  expect(await screen.findByText('Nested 404')).toBeOnTheScreen();
  expect(screen).toHavePathnameWithParams('/nested/123/456?test=true');
  expect(screen).toHaveSearchParams({
    test: 'true',
    'not-found': ['123', '456'],
  });
});

it('supports dynamic 404s next to dynamic routes', async () => {
  renderRouter({
    index: () => <Text />,
    '[slug]': () => <Text>found</Text>,
    '+not-found': () => <Text>404</Text>,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/123'));
  expect(screen).toHavePathname('/123');
  expect(await screen.findByText('found')).toBeOnTheScreen();
});

it('supports deep dynamic 404s next to dynamic routes', async () => {
  renderRouter({
    index: () => <Text />,
    '+not-found': () => <Text>404</Text>,
    '[...slug]': () => <Text>found</Text>,
  });

  expect(screen).toHavePathname('/');

  act(() => router.push('/123'));
  expect(screen).toHavePathname('/123');
  expect(await screen.findByText('found')).toBeOnTheScreen();
});

it('can deep link, pop back, and move around with initialRouteName in root layout', async () => {
  renderRouter(
    {
      _layout: {
        unstable_settings: {
          initialRouteName: 'index',
        },
        default: () => (
          <Stack>
            <Stack.Screen name="index" />
            <Stack.Screen name="a" />
          </Stack>
        ),
      },
      index: () => <Text />,
      'a/_layout': () => <Stack />,
      'a/b/index': () => <Text />,
    },
    {
      initialUrl: '/a/b',
    }
  );
  expect(screen).toHavePathname('/a/b');
  act(() => router.back());
  expect(screen).toHavePathname('/');

  act(() => router.push('/a/b'));
  expect(screen).toHavePathname('/a/b');
});

afterEach(() => {
  delete process.env.EXPO_BASE_URL;
});

it('respects baseUrl', async () => {
  process.env.EXPO_BASE_URL = '/one/two';

  renderRouter({
    index: function Index() {
      const pathname = usePathname();
      return <Text testID="rendered-path">{pathname}</Text>;
    },
  });

  expect(screen).toHavePathname('/');

  const text = await screen.findByTestId('rendered-path');

  expect(text).toHaveTextContent('/');
});

it('can redirect within a group layout', () => {
  renderRouter({
    '(group)/_layout': function Component() {
      const pathname = usePathname();

      if (pathname === '/') {
        return <Redirect href="/page" />;
      }

      return <Stack />;
    },
    '(group)/index': () => <Text testID="index" />,
    '(group)/page': () => <Text testID="page" />,
  });

  expect(screen).toHavePathname('/page');
  expect(screen.getByTestId('page')).toBeOnTheScreen();
});

it('can replace across groups', async () => {
  renderRouter({
    _layout: () => <Tabs />,
    'one/_layout': () => <Stack />,
    'one/screen': () => <Text testID="one/screen" />,
    'two/_layout': () => <Stack />,
    'two/screen': () => <Text testID="two/screen" />,
  });

  // There is no index route
  expect(screen).toHavePathname('/');
  expect(screen).toHaveSegments(['+not-found']);

  // Go to one
  act(() => router.push('/one/screen'));
  expect(screen).toHavePathname('/one/screen');
  expect(screen.getByTestId('one/screen')).toBeOnTheScreen();

  // Push to two
  act(() => router.push('/two/screen'));
  expect(screen).toHavePathname('/two/screen');
  expect(screen.getByTestId('two/screen')).toBeOnTheScreen();

  // Replace with one. This will create a history of ['one', 'one']
  act(() => router.replace('/one/screen'));
  expect(screen).toHavePathname('/one/screen');
  expect(screen.getByTestId('one/screen')).toBeOnTheScreen();

  expect(router.canGoBack()).toBe(false);
});

it('can push nested stacks without creating circular references', async () => {
  renderRouter({
    _layout: () => <Stack />,
    index: () => <Text />,
    'menu/_layout': () => <Stack />,
    'menu/[id]': () => <Text />,
    'menu/index': () => <Text />,
  });
  expect(screen).toHavePathname('/');
  act(() => router.push('/menu'));
  act(() => router.push('/menu/123'));
  expect(screen).toHavePathname('/menu/123');
});

it('can push nested stacks with initial route names without creating circular references', async () => {
  renderRouter({
    _layout: { initialRouteName: 'index', default: () => <Stack /> },
    index: () => <Text />,
    'menu/_layout': { initialRouteName: 'index', default: () => <Stack /> },
    'menu/[id]': () => <Text />,
    'menu/index': () => <Text />,
  });
  expect(screen).toHavePathname('/');
  act(() => router.push('/menu'));
  act(() => router.push('/menu/123'));
  expect(screen).toHavePathname('/menu/123');
});

it('can replace with nested Slots', async () => {
  renderRouter({
    _layout: () => <Slot />,
    index: () => <Text testID="index" />,
    'one/_layout': () => <Slot />,
    'one/index': () => <Text testID="one" />,
  });

  // Replace
  act(() => router.replace('/one'));
  expect(screen).toHavePathname('/one');
  expect(screen.getByTestId('one')).toBeOnTheScreen();

  act(() => router.replace('/'));
  expect(screen).toHavePathname('/');
});

it('can push with top-level catch-all route', () => {
  renderRouter({
    '[...all]': () => <Text testID="index" />,
  });

  expect(screen).toHavePathname('/');
  expect(screen.getByTestId('index')).toBeOnTheScreen();

  // // If we push once and go back, we are back to index
  act(() => router.push('/test'));
  expect(screen.getByTestId('index')).toBeOnTheScreen();
});

it('can push the same route multiple times', () => {
  renderRouter({
    index: () => <Text testID="index" />,
    test: () => <Text testID="test" />,
  });

  expect(screen).toHavePathname('/');
  expect(screen.getByTestId('index')).toBeOnTheScreen();

  // // If we push once and go back, we are back to index
  act(() => router.push('/test'));
  expect(screen.getByTestId('test')).toBeOnTheScreen();
  act(() => router.back());
  expect(screen.getByTestId('index')).toBeOnTheScreen();

  // If we push twice we will need to go back twice
  act(() => router.push('/test'));
  act(() => router.push('/test'));
  expect(screen.getByTestId('test')).toBeOnTheScreen();
  act(() => router.back());
  expect(screen.getByTestId('test')).toBeOnTheScreen();
  act(() => router.back());
  expect(screen.getByTestId('index')).toBeOnTheScreen();
});

describe('relative urls', () => {
  it('can push relative links from index routes', async () => {
    renderRouter(
      {
        _layout: () => <Slot />,
        '(app)/test/_layout': () => <Stack />,
        '(app)/test/index': () => <Text testID="two" />,
        '(app)/test/bar': () => <Text testID="three" />,
      },
      {
        initialUrl: '/test',
      }
    );

    expect(screen).toHavePathname('/test');
    expect(screen.getByTestId('two')).toBeOnTheScreen();

    act(() => router.push('./test/bar'));
    expect(screen.getByTestId('three')).toBeOnTheScreen();
    expect(screen).toHavePathname('/test/bar');
  });

  it('can push relative links relative to the directory', async () => {
    renderRouter(
      {
        _layout: () => <Slot />,
        '(app)/index': () => <Text testID="one" />,
        '(app)/test/_layout': () => <Stack />,
        '(app)/test/index': () => <Text testID="two" />,
        '(app)/test/bar': () => <Text testID="three" />,
      },
      {
        initialUrl: '/test',
      }
    );

    expect(screen).toHavePathname('/test');
    expect(screen.getByTestId('two')).toBeOnTheScreen();

    act(() => router.push('./bar', { relativeToDirectory: true }));
    expect(screen.getByTestId('three')).toBeOnTheScreen();
    expect(screen).toHavePathname('/test/bar');
  });

  it('can push relative links from hoisted routes', () => {
    renderRouter(
      {
        _layout: () => <Stack />,
        'parent/index': () => <Link testID="link" href="./parent/child" />,
        'parent/child': () => <View testID="child" />,
      },
      {
        initialUrl: '/parent',
      }
    );

    expect(screen.getByTestId('link')).toBeOnTheScreen();
    fireEvent(screen.getByTestId('link'), 'press');
    expect(screen.getByTestId('child')).toBeOnTheScreen();
  });

  it('can push relative links from hoisted routes relative to the directory', () => {
    renderRouter(
      {
        _layout: () => <Stack />,
        'parent/index': () => <Link testID="link" href="./child" relativeToDirectory />,
        'parent/child': () => <View testID="child" />,
      },
      {
        initialUrl: '/parent',
      }
    );

    expect(screen.getByTestId('link')).toBeOnTheScreen();
    fireEvent(screen.getByTestId('link'), 'press');
    expect(screen.getByTestId('child')).toBeOnTheScreen();
  });
});

it('can navigation to a relative route without losing path params', async () => {
  renderRouter(
    {
      _layout: () => <Slot />,
      '(group)/[value]/one': () => <Text testID="one" />,
      '(group)/[value]/two': () => <Text testID="two" />,
      '(group)/[...value]/three': () => <Text testID="three" />,
      '(group)/[...value]/four': () => <Text testID="four" />,
    },
    {
      initialUrl: '/test/one',
    }
  );

  expect(screen).toHavePathname('/test/one');
  expect(screen.getByTestId('one')).toBeOnTheScreen();

  act(() => router.push('./two'));
  expect(screen).toHavePathname('/test/two');
  expect(screen.getByTestId('two')).toBeOnTheScreen();

  act(() => router.push('../apple/one?orange=1'));
  expect(screen).toHavePathname('/apple/one');
  expect(screen.getByTestId('one')).toBeOnTheScreen();

  act(() => router.push('./two'));
  expect(screen).toHavePathname('/apple/two');
  expect(screen.getByTestId('two')).toBeOnTheScreen();

  act(() => router.push('./three'));
  expect(screen).toHavePathname('/apple/three');
  expect(screen.getByTestId('three')).toBeOnTheScreen();

  act(() => router.push('./banana/four'));
  expect(screen).toHavePathname('/apple/banana/four');
  expect(screen.getByTestId('four')).toBeOnTheScreen();

  act(() => router.push('./three'));
  expect(screen).toHavePathname('/apple/banana/three');
  expect(screen.getByTestId('three')).toBeOnTheScreen();
});

it('can navigation to a relative route with query params without losing path params', async () => {
  renderRouter(
    {
      _layout: () => <Slot />,
      '(group)/[value]/one': () => <Text testID="one" />,
      '(group)/[value]/two': () => <Text testID="two" />,
      '(group)/[...value]/three': () => <Text testID="three" />,
      '(group)/[...value]/four': () => <Text testID="four" />,
    },
    {
      initialUrl: '/test/one',
    }
  );

  expect(screen).toHavePathname('/test/one');
  expect(screen.getByTestId('one')).toBeOnTheScreen();

  act(() => router.push('./two?hello=world'));
  expect(screen).toHavePathname('/test/two');
  expect(screen).toHavePathnameWithParams('/test/two?hello=world');
  expect(screen.getByTestId('two')).toBeOnTheScreen();
  expect(screen).toHaveSearchParams({
    value: 'test',
    hello: 'world',
  });

  act(() => router.push('./one?foo=bar'));
  expect(screen).toHavePathname('/test/one');
  expect(screen).toHavePathnameWithParams('/test/one?foo=bar');
  expect(screen.getByTestId('one')).toBeOnTheScreen();
  expect(screen).toHaveSearchParams({
    value: 'test',
    foo: 'bar',
  });

  act(() => router.back());
  expect(screen).toHavePathname('/test/two');
  expect(screen).toHavePathnameWithParams('/test/two?hello=world');
  expect(screen.getByTestId('two')).toBeOnTheScreen();
  expect(screen).toHaveSearchParams({
    value: 'test',
    hello: 'world',
  });
});

describe('shared routes with tabs', () => {
  function renderSharedTabs() {
    renderRouter({
      '(one,two)/_layout': () => <Stack />,
      '(one,two)/one': () => <Text />,
      '(one,two)/post': () => <Text />,
      '(two)/two': () => <Text />,
      _layout: () => <Tabs />,
      index: () => <Redirect href="/one" />,
    });

    expect(screen).toHavePathname('/one');
  }

  describe('tab one (default)', () => {
    it('pushes post in tab one using absolute /post', async () => {
      renderSharedTabs();
      act(() => router.push('/post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(one)', 'post']);
    });
    it('pushes post in tab one using absolute /(tabs)/(one)/post', async () => {
      renderSharedTabs();
      act(() => router.push('/(one)/post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(one)', 'post']);
    });
    it('pushes post in tab one using relative ./post', async () => {
      renderSharedTabs();
      act(() => router.push('./post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(one)', 'post']);
    });
  });
  describe('tab two', () => {
    // Navigate to tab two before each case here.
    beforeEach(() => {
      renderSharedTabs();
      act(() => router.push('/two'));
      expect(screen).toHavePathname('/two');
      expect(screen).toHaveSegments(['(two)', 'two']);
    });

    it('pushes post in tab two with absolute `/post` stays within the group', async () => {
      act(() => router.push('/post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(two)', 'post']);
    });
    it('pushes post in tab two using absolute /(tabs)/(two)/post', async () => {
      act(() => router.push('/(two)/post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(two)', 'post']);
    });
    it('pushes post in tab two using relative ./post', async () => {
      // Pushing `./post` should preserve the relative position in tab two and NOT swap to the default tab one variation of the `/post` route.
      act(() => router.push('./post'));
      expect(screen).toHavePathname('/post');
      expect(screen).toHaveSegments(['(two)', 'post']);
    });
  });
});

it('will warn if a href provides duplicate parameters (single)', async () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  renderRouter({
    index: () => <Redirect href="/test?id=test23" />,
    '[id]': () => <Text />,
  });

  // If there is both a param and a path, use the param
  expect(screen).toHavePathname('/test');

  expect(spy).toHaveBeenNthCalledWith(
    1,
    "Route '/[id]' with param 'id' was specified both in the path and as a param, removing from path"
  );
});

it('will warn if a href provides duplicate parameters (wildcard)', async () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  renderRouter({
    index: () => <Redirect href="/test?id=test23" />,
    '[...id]': () => <Text />,
  });

  // If there is both a param and a path, use the param
  expect(screen).toHavePathname('/test');

  expect(spy).toHaveBeenNthCalledWith(
    1,
    "Route '/[...id]' with param 'id' was specified both in the path and as a param, removing from path"
  );
});

describe('consistent url encoding', () => {
  it('can handle url encoded deep linking', async () => {
    renderRouter(
      {
        '[param]': () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/start%26end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/start&end');
    expect(screen).toHaveSearchParams({ param: 'start&end' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start&end' }, global: { param: 'start&end' } })
    );
  });

  it('can handle %25 (percent sign) deep linking', async () => {
    renderRouter(
      {
        '[param]': () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/start%25end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/start%end');
    expect(screen).toHaveSearchParams({ param: 'start%end' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start%end' }, global: { param: 'start%end' } })
    );
  });

  it('can handle parenthesis in the url', async () => {
    renderRouter(
      {
        '[param]': () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
        '(app)/value/[param]': () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/(param)',
      }
    );

    let component = screen.getByTestId('id');
    expect(screen).toHavePathname('/(param)');
    expect(screen).toHaveSearchParams({ param: '(param)' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: '(param)' }, global: { param: '(param)' } })
    );

    act(() => router.push('/(app)/value/(param)'));

    component = screen.getByTestId('id');
    expect(screen).toHavePathname('/value/(param)');
    expect(screen).toHaveSearchParams({ param: '(param)' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: '(param)' }, global: { param: '(param)' } })
    );
  });

  it('can handle non-url encoded percent sign deep linking', async () => {
    renderRouter(
      {
        '[param]': () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/start%end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/start%end');
    expect(screen).toHaveSearchParams({ param: 'start%end' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start%end' }, global: { param: 'start%end' } })
    );
  });

  it('can handle deep linking urls with encoded search params ', async () => {
    renderRouter(
      {
        test: () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: 'test?param=start%26end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/test');
    expect(screen).toHaveSearchParams({ param: 'start&end' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start&end' }, global: { param: 'start&end' } })
    );
  });

  it('can handle deep linking to index with encoded search params ', async () => {
    renderRouter(
      {
        index: () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/?param=start%26end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/');
    expect(screen).toHaveSearchParams({ param: 'start&end' });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start&end' }, global: { param: 'start&end' } })
    );
  });

  it('can handle url encoded linking', async () => {
    renderRouter(
      {
        '[param]': () => <Text />,
      },
      {
        initialUrl: '/test',
      }
    );

    act(() => router.push('/start%20end'));

    expect(screen).toHavePathname('/start end');
    expect(screen).toHaveSearchParams({
      param: 'start end',
    });

    act(() => router.push('/start%21end'));

    expect(screen).toHavePathname('/start!end');
    expect(screen).toHaveSearchParams({
      param: 'start!end',
    });

    act(() => router.back());

    expect(screen).toHavePathname('/start end');
    expect(screen).toHaveSearchParams({
      param: 'start end',
    });
  });

  it('can handle linking to index with encoded params', async () => {
    renderRouter(
      {
        index: () => <Text />,
        '[param]': () => <Text />,
      },
      {
        initialUrl: '/test',
      }
    );

    act(() => router.push('/?param=start%20end'));
    expect(screen).toHavePathname('/');
    expect(screen).toHaveSearchParams({
      param: 'start end',
    });
  });

  it('can handle url encoded param names', async () => {
    renderRouter(
      {
        test: () => {
          const local = useLocalSearchParams();
          const global = useGlobalSearchParams();
          return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
        },
      },
      {
        initialUrl: '/test?par%20am=start%20end',
      }
    );

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/test');
    expect(screen).toHaveSearchParams({
      'par am': 'start end',
    });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { 'par am': 'start end' }, global: { 'par am': 'start end' } })
    );
  });

  it('can handle pushing non-url encoded routes', async () => {
    renderRouter({
      index: () => null,
      test: () => {
        const local = useLocalSearchParams();
        const global = useGlobalSearchParams();
        return <Text testID="id">{JSON.stringify({ local, global })}</Text>;
      },
    });

    act(() => router.push('/test?param=start%end'));

    const component = screen.getByTestId('id');
    expect(screen).toHavePathname('/test');
    expect(screen).toHaveSearchParams({
      param: 'start%end',
    });
    expect(component).toHaveTextContent(
      JSON.stringify({ local: { param: 'start%end' }, global: { param: 'start%end' } })
    );
  });
});

describe('stack unwinding', () => {
  // TODO: Navigated changed to be like push
  it.skip('navigate will unwind the stack', () => {
    renderRouter(
      {
        '[test]': () => null,
      },
      {
        initialUrl: '/a',
      }
    );

    act(() => router.navigate('/a')); // This will rerender and not push
    act(() => router.navigate('/b'));
    act(() => router.navigate('/c'));
    act(() => router.navigate('/a')); // This will unwind the stack

    expect(router.canGoBack()).toBe(false);
  });

  it('push will never unwind the stack', () => {
    renderRouter(
      {
        '[test]': () => null,
      },
      {
        initialUrl: '/a',
      }
    );

    act(() => router.push('/a'));
    act(() => router.push('/b'));
    act(() => router.push('/c'));
    act(() => router.push('/a')); // This will unwind the stack

    expect(router.canGoBack()).toBe(true); //
  });
});

it('should always prefer static routes over dynamic ones', async () => {
  renderRouter(
    {
      // Uses Layouts at different levels to create different hoisting for each group
      '(tabs)/nested/_layout': () => null,
      '(tabs)/nested/index': () => null,
      '(tabs)/nested/[fruit]': () => null,
      '(tabs)/nested/orange': () => null,
      '(stack)/_layout': () => null,
      '(stack)/nested/banana': () => null,
      '(stack)/nested/[fruit]': () => null,
      'nested/grape': () => null,
      'nested/[fruit]': () => null,
      '[param]/melon': () => null,
    },
    {
      initialUrl: '/(tabs)/nested/apple',
    }
  );

  // We start in (tabs)
  expect(screen).toHavePathname('/nested/apple');
  expect(screen).toHaveSegments(['(tabs)', 'nested', '[fruit]']);

  // Banana is more specific in (stack) so we move
  act(() => router.push('/nested/banana'));
  expect(screen).toHaveSegments(['(stack)', 'nested', 'banana']);

  // Apple could be in either (tabs) or (stack) so we stay in the same group
  act(() => router.push('/nested/apple'));
  expect(screen).toHavePathname('/nested/apple');
  expect(screen).toHaveSegments(['(stack)', 'nested', '[fruit]']);

  // Orange is more specific in (tabs) so we move
  act(() => router.push('/nested/orange'));
  expect(screen).toHavePathname('/nested/orange');
  expect(screen).toHaveSegments(['(tabs)', 'nested', 'orange']);

  // Grape is more specific outside any group
  act(() => router.push('/nested/grape'));
  expect(screen).toHavePathname('/nested/grape');
  expect(screen).toHaveSegments(['nested', 'grape']);

  // This matches /(tabs)/nested/[fruit].
  // We don't match:
  // - nested/[fruit] because /(tabs)/nested/fruit is more specific
  // - [param]/melon because segments are evaluated left-right. 'nested' is static and '[param]' is dynamic
  act(() => router.push('/nested/melon'));
  expect(screen).toHavePathname('/nested/melon');
  expect(screen).toHaveSegments(['(tabs)', 'nested', '[fruit]']);
});

it('can push relative links that are relative to the directory', () => {
  renderRouter(
    {
      '(stack)/_layout': () => <Stack />,
      '(stack)/[fruit]/index': function Fruit() {
        const { fruit } = useLocalSearchParams();
        return <Text testID="fruit">{fruit}</Text>;
      },
    },
    {
      initialUrl: '/apple',
    }
  );

  expect(screen.getByText('apple')).toBeOnTheScreen();
  act(() => router.push('./banana'));
  expect(screen.getByText('banana')).toBeOnTheScreen();
});

it('respects nested unstable settings', async () => {
  renderRouter({
    _layout: () => <Stack />,
    '(app)/_layout': () => {
      return (
        <Tabs>
          <Tabs.Screen name="(index)" options={{ title: 'Home' }} />
          <Tabs.Screen name="(search)" options={{ title: 'Search' }} />
          <Tabs.Screen name="(profile)" options={{ title: 'Profile' }} />
        </Tabs>
      );
    },
    '(app)/(index,search,profile)/_layout': {
      unstable_settings: {
        index: { initialRouteName: 'index' },
        search: { initialRouteName: 'search' },
        profile: { initialRouteName: 'profile' },
      },
      default: () => <Stack />,
    },
    '(app)/(index,search,profile)/index': () => <Text testID="index">Index Screen</Text>,
    '(app)/(index,search,profile)/search': () => <Text testID="search">Search Screen</Text>,
    '(app)/(index,search,profile)/profile': () => <Text testID="profile">Profile Screen</Text>,
  });

  expect(screen.getByTestId('index')).toBeVisible();
  fireEvent.press(screen.getByText('Search'), {});
  expect(screen.getByTestId('search')).toBeVisible();
  fireEvent.press(screen.getByText('Profile'), {});
  expect(screen.getByTestId('profile')).toBeVisible();
  fireEvent.press(screen.getByText('Home'), {});
  expect(screen.getByTestId('index')).toBeVisible();
});

describe('navigation action fallbacks', () => {
  function runPushTest() {
    act(() => router.navigate('/'));
    expect(screen).toHavePathname('/');

    // Go to one
    act(() => router.navigate('/one'));
    expect(screen).toHavePathname('/one');
    expect(screen.getByTestId('one')).toBeOnTheScreen();

    // Push to two. `PUSH` action should fall back to `NAVIGATE` action
    act(() => router.push('/two'));
    expect(screen).toHavePathname('/two');
    expect(screen.getByTestId('two')).toBeOnTheScreen();
  }

  function runReplaceTest() {
    act(() => router.navigate('/'));
    expect(screen).toHavePathname('/');

    // Go to one
    act(() => router.navigate('/one'));
    expect(screen).toHavePathname('/one');
    expect(screen.getByTestId('one')).toBeOnTheScreen();

    // Replace to two. `REPLACE` action should fall back to `JUMP_TO` action
    act(() => router.replace('/two'));
    expect(screen).toHavePathname('/two');
    expect(screen.getByTestId('two')).toBeOnTheScreen();
  }

  function runRedirectionTest() {
    act(() => router.navigate('/'));
    expect(screen).toHavePathname('/');

    // `<Redirect />` uses `REPLACE` action and should fall back to `JUMP_TO` action
    act(() => router.navigate('/redirected'));
    expect(screen).toHavePathname('/');
  }

  it('can fall back correctly for tab navigators', () => {
    renderRouter({
      _layout: () => <Tabs />,
      one: () => <Text testID="one" />,
      two: () => <Text testID="two" />,
      redirected: () => <Redirect href="/" />,
    });

    runPushTest();
    runReplaceTest();
    runRedirectionTest();
  });

  // it('can fall back correctly for drawer navigators', () => {
  //   renderRouter({
  //     _layout: () => <Drawer useLegacyImplementation={false} />,
  //     one: () => <Text testID="one" />,
  //     two: () => <Text testID="two" />,
  //     redirected: () => <Redirect href="/" />,
  //   });

  //   runPushTest();
  //   runReplaceTest();
  //   runRedirectionTest();
  // });
});
