import {
  GraphQLBoolean,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql/index.js';
import { UUID } from './uuid.js';
import { MemberTypeIdEnum, memberTypes } from './memberTypes.js';


export const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    userId: { type: new GraphQLNonNull(UUID) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
  }
});

export const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeIdEnum },
  }
});

export const profiles = new GraphQLObjectType({
  name: 'profiles',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async (data) => data.id
    },
    isMale: {
      type: GraphQLBoolean,
      resolve: async (data) => data.isMale
    },
    yearOfBirth: {
      type: GraphQLInt,
      resolve: async (data) => data.yearOfBirth
    },
    memberType: {
      type: memberTypes,
      resolve: async (data) => data.memberType
    }
  }
})