import {
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql/index.js';
import { posts } from './posts.js';
import { profiles } from './profiles.js';

export const users = new GraphQLObjectType({
  name: 'users',
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    profile: {
      type: profiles,
      resolve: async (user, _, prisma) =>
        prisma.loaders.profiles.load(user.id)
    },
    posts: {
      type: new GraphQLList(posts),
      resolve: async (user, _, prisma) =>
        prisma.loaders.posts.load(user.id)
    },
    userSubscribedTo: {
      type: new GraphQLList(users),
      resolve: async (user, _, prisma) => {
        if (Array.isArray((user as any).userSubscribedTo)) {
          return (user as any).userSubscribedTo;
        }
        return prisma.loaders.userSubscribedTo.load(user.id);
      }
    },
    subscribedToUser: {
      type: new GraphQLList(users),
      resolve: async (user, _, prisma) => {
        if (Array.isArray((user as any).subscribedToUser)) {
          return (user as any).subscribedToUser;
        }
        return prisma.loaders.subscribedToUser.load(user.id);
      }
    },
  })
});


export const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  }
});

export const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  }
});
