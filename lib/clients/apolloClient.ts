import { useMemo } from "react";
import { ApolloClient, InMemoryCache, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import merge from "deepmerge";
import isEqual from "lodash/isEqual";
import { createUploadLink } from "apollo-upload-client";

import paginationField from "./paginationField";

//#########################################
//#########################################
//#########################################

export const APOLLO_STATE_PROP_NAME = "__APOLLO_STATE__";

let apolloClient;

function createApolloClient() {
  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    link: from([
      onError(({ graphQLErrors, networkError }) => {
        if (graphQLErrors)
          graphQLErrors.map(({ message, locations, path }) =>
            console.log(
              `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
            )
          );
        if (networkError) console.log(`[Network error]: ${networkError}`);
      }),
      createUploadLink({
        uri: "http://localhost:3000/api/graphql", // Server URL (must be absolute)
        credentials: "include", // Additional fetch() options like `credentials` or `headers`
      }),
    ]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            allProducts: paginationField(),
          },
        },
      },
    }),
  });
}

export function initializeApollo(initialState = null) {
  const _apolloClient = apolloClient ?? createApolloClient();

  //=======================================
  //    IF INITIAL STATE IS AVAILABLE
  //=======================================
  // If your page has Next.js data fetching methods that use Apollo Client, the initial state
  // gets hydrated here
  if (initialState) {
    // Get existing cache, loaded during client side data fetching
    const existingCache = _apolloClient.extract();

    // Merge the existing cache into data passed from getStaticProps/getServerSideProps
    const data = merge(initialState, existingCache, {
      // combine arrays using object equality (like in sets)
      arrayMerge: (destinationArray, sourceArray) => [
        ...sourceArray,
        ...destinationArray.filter((d) =>
          sourceArray.every((s) => !isEqual(d, s))
        ),
      ],
    });

    // Restore the cache with the merged data
    _apolloClient.cache.restore(data);
  }

  //========================================
  //      SERVER SIDE RENDERING
  //========================================
  // For SSG and SSR always create a new Apollo Client
  if (typeof window === "undefined") return _apolloClient;

  //=========================================
  //     CLIENT SIDE RENDERING
  //=========================================
  // Create the Apollo Client once in the client
  if (!apolloClient) apolloClient = _apolloClient;

  return _apolloClient;
}

export function addApolloState(client, { props }) {
  if (props) {
    props[APOLLO_STATE_PROP_NAME] = client.cache.extract();
  }

  return pageProps;
}

export function useApollo(pageProps) {
  const state = pageProps[APOLLO_STATE_PROP_NAME];
  const store = useMemo(() => initializeApollo(state), [state]);
  return store;
}
