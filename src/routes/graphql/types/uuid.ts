import { GraphQLScalarType, Kind } from 'graphql/index.js';

export const UUID = new GraphQLScalarType({
  name: 'UUID',
  serialize: String,
  parseValue: String,
  parseLiteral: ast => (ast.kind === Kind.STRING ? ast.value : null)
});
