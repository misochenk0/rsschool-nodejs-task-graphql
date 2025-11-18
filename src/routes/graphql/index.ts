import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLScalarType,
  Kind,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLEnumType,
} from 'graphql';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      return graphql({
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
        contextValue: prisma,
      });
    },
  });
};

const UUID = new GraphQLScalarType({
  name: 'UUID',
  serialize: String,
  parseValue: String,
  parseLiteral: ast => (ast.kind === Kind.STRING ? ast.value : null)
});

const MemberTypeIdEnum = new GraphQLEnumType({
  name: "MemberTypeId",
  values: {
    BASIC: { value: "BASIC" },
    BUSINESS: { value: "BUSINESS" }
  }
});

const memberTypes = new GraphQLObjectType({
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

const posts = new GraphQLObjectType({
  name: 'posts',
  fields: {
    id: {
      type: GraphQLString,
      resolve: async (data) => data.id
    },
    title: {
      type: GraphQLString,
      resolve: async (data) => data.title
    },
    content: {
      type: GraphQLString,
      resolve: async (data) => data.content
    }
  }
})

const profiles = new GraphQLObjectType({
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

const users = new GraphQLObjectType({
  name: 'users',
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    profile: { type: profiles },
    posts: { type: new GraphQLList(posts) },

    userSubscribedTo: {
      type: new GraphQLList(users),
      resolve: async (data, _, prisma) => {
        const relations = await prisma.subscribersOnAuthors.findMany({
          where: { subscriberId: data.id },
          include: { author: true },
        });

        return relations.map(r => ({
          ...r.author,
          subscribedToUser: async () => {
            const nestedRelations = await prisma.subscribersOnAuthors.findMany({
              where: { authorId: r.author.id },
              include: { subscriber: true },
            });
            return nestedRelations.map(nr => nr.subscriber);
          }
        }));
      }
    },
    subscribedToUser: {
      type: new GraphQLList(users),
      resolve: async (data, _, prisma) => {
        const relations = await prisma.subscribersOnAuthors.findMany({
          where: { authorId: data.id },
          include: { subscriber: true },
        });

        return relations.map(r => ({
          ...r.subscriber,
          userSubscribedTo: async () => {
            const nestedRelations = await prisma.subscribersOnAuthors.findMany({
              where: { subscriberId: r.subscriber.id },
              include: { author: true },
            });
            return nestedRelations.map(nr => nr.author);
          }
        }));
      }
    },
  })
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
      memberTypes: {
        type: new GraphQLList(memberTypes),
        description: 'Returns all member types',
        resolve: async (_, __, prisma) => await prisma.memberType.findMany(),
      },
      memberType: {
        type: memberTypes,
        args: { id: { type: new GraphQLNonNull(MemberTypeIdEnum) } },
        resolve: (_, { id }, prisma) =>
          prisma.memberType.findUnique({ where: { id } }),
      },
      posts: {
        type: new GraphQLList(posts),
        description: 'Return all posts',
        resolve: async (_, __, prisma) => await prisma.post.findMany()
      },
      post: {
        type: posts,
        args: {
          id: { type: new GraphQLNonNull(UUID) }
        },
        resolve: async (_, { id }, prisma) => await prisma.post.findUnique({ where: { id } })
      },
      users: {
        type: new GraphQLList(users),
        description: 'Return all users',
        resolve: async (_, __, prisma) => await prisma.user.findMany({
          include: {
            profile: {
              include: { memberType: true }
            },
            posts: true,
          }
        })
      },
      user: {
        type: users,
        args: {
          id: { type: new GraphQLNonNull(UUID) }
        },
        resolve: async (_, { id }, prisma) => await prisma.user.findUnique({ where: { id },
          include: {
            profile: {
              include: { memberType: true }
            },
            posts: true,
            userSubscribedTo: {
              include: { subscriber: true }
            },
            subscribedToUser: {
              include: { author: true }
            },
          }})
      },
      profiles: {
        type: new GraphQLList(profiles),
        description: 'Return all profiles',
        resolve: async (_, __, prisma) => await prisma.profile.findMany()
      },
      profile: {
        type: profiles,
        args: {
          id: { type: new GraphQLNonNull(UUID) }
        },
        resolve: async (_, { id }, prisma) => await prisma.profile.findUnique({ where: { id } })
      },
    }
  })
})

export default plugin;
