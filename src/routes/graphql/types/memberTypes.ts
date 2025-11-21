import {
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql/index.js';

export const memberTypes = new GraphQLObjectType({
  name: 'MemberTypes',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async function (data) {
        return data.id;
      }
    },
    discount: {
      type: GraphQLFloat,
      resolve: async function (data) {
        return data.discount;
      }
    },
    postsLimitPerMonth: {
      type: GraphQLString,
      resolve: async function (data) {
        return data.postsLimitPerMonth
      }
    }
  }
})


export const MemberTypeIdEnum = new GraphQLEnumType({
  name: "MemberTypeId",
  values: {
    BASIC: { value: "BASIC" },
    BUSINESS: { value: "BUSINESS" }
  }
});
