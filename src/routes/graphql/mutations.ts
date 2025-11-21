import { GraphQLNonNull, GraphQLObjectType } from 'graphql/index.js';
import { ChangeUserInput, CreateUserInput, users } from './types/users.js';
import { UUID } from './types/uuid.js';
import { ChangePostInput, CreatePostInput, posts } from './types/posts.js';
import { ChangeProfileInput, CreateProfileInput, profiles } from './types/profiles.js';

export const mutation = new GraphQLObjectType({
  name: 'RootMutation',
  fields: {
    createUser: {
      type: users,
      args: {
        dto: { type: new GraphQLNonNull(CreateUserInput) },
      },
      resolve: async (_, { dto }, prisma) => {
        return prisma.user.create({ data: dto });
      }
    },
    deleteUser: {
      type: UUID,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
      },
      resolve: async (_, { id }, prisma) => {
        return prisma.user.delete({ where: { id } });
      }
    },
    changeUser: {
      type: users,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
        dto: { type: new GraphQLNonNull(ChangeUserInput) },
      },
      resolve: async (_, { id, dto }, prisma) => {
        return prisma.user.update({ where: { id }, data: dto });
      }
    },
    createPost: {
      type: posts,
      args: {
        dto: { type: new GraphQLNonNull(CreatePostInput) },
      },
      resolve: async (_, { dto }, prisma) => {
        return prisma.post.create({ data: dto });
      }
    },
    deletePost: {
      type: UUID,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
      },
      resolve: async (_, { id }, prisma) => {
        return prisma.post.delete({ where: { id } });
      }
    },
    changePost: {
      type: posts,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
        dto: { type: new GraphQLNonNull(ChangePostInput) },
      },
      resolve: async (_, { id, dto }, prisma) => {
        return prisma.post.update({ where: { id }, data: dto });
      }
    },
    createProfile: {
      type: profiles,
      args: {
        dto: { type: new GraphQLNonNull(CreateProfileInput) },
      },
      resolve: async (_, { dto }, prisma) => {
        return prisma.profile.create({ data: dto });
      }
    },
    deleteProfile: {
      type: UUID,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
      },
      resolve: async (_, { id }, prisma) => {
        return prisma.profile.delete({ where: { id } });
      }
    },
    changeProfile: {
      type: profiles,
      args: {
        id: { type: new GraphQLNonNull(UUID) },
        dto: { type: new GraphQLNonNull(ChangeProfileInput) },
      },
      resolve: async (_, { id, dto }, prisma) => {
        return prisma.profile.update({ where: { id }, data: dto });
      }
    },
    subscribeTo: {
      type: UUID,
      args: {
        userId: { type: new GraphQLNonNull(UUID) },
        authorId: { type: new GraphQLNonNull(UUID) },
      },
      resolve: async (_, { userId, authorId }, prisma) => {
        return prisma.subscribersOnAuthors.create({ data: { subscriberId: userId, authorId } });
      },
    },
    unsubscribeFrom: {
      type: UUID,
      args: {
        userId: { type: new GraphQLNonNull(UUID) },
        authorId: { type: new GraphQLNonNull(UUID) },
      },
      resolve: async (_, { userId, authorId }, prisma) => {
        return prisma.subscribersOnAuthors.delete({ where: { subscriberId_authorId: { subscriberId: userId, authorId } } });
      },
    },
  }
})