import { PrismaClient } from '@prisma/client'
export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      // take all 'undeleted' records with OVERRIDE option
      async findMany({ model, operation, args, query }) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUnique({ model, operation, args, query }) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirst({ model, operation, args, query }) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findFirstOrThrow({ model, operation, args, query }) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
      async findUniqueOrThrow({ model, operation, args, query }) {
        args.where = { deletedAt: null, ...args.where }
        return query(args)
      },
    },
  },
})