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
  GraphQLInputObjectType,
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


const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(UUID) },
  }
});

const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
  }
});

const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  }
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  }
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    userId: { type: new GraphQLNonNull(UUID) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
  }
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeIdEnum },
  }
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
  }),
  mutation: new GraphQLObjectType({
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
})

export default plugin;
