import { mutation } from './mutations.js';
import { query } from './query.js';
import { GraphQLSchema } from 'graphql';

export const schema = new GraphQLSchema({ query, mutation })