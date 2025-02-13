import type { TSESLint } from '@typescript-eslint/utils'

import type { SortingNode } from '../typings'

import { createEslintRule } from '../utils/create-eslint-rule'
import { getGroupNumber } from '../utils/get-group-number'
import { getNodeRange } from '../utils/get-node-range'
import { toSingleLine } from '../utils/to-single-line'
import { rangeToDiff } from '../utils/range-to-diff'
import { isPositive } from '../utils/is-positive'
import { SortOrder, SortType } from '../typings'
import { useGroups } from '../utils/use-groups'
import { sortNodes } from '../utils/sort-nodes'
import { complete } from '../utils/complete'
import { pairwise } from '../utils/pairwise'
import { compare } from '../utils/compare'

type MESSAGE_ID = 'unexpectedClassesOrder'

type Group =
  | 'static-private-method'
  | 'private-property'
  | 'static-property'
  | 'index-signature'
  | 'private-method'
  | 'static-method'
  | 'constructor'
  | 'get-method'
  | 'set-method'
  | 'property'
  | 'unknown'
  | 'method'

type Options = [
  Partial<{
    groups: (Group[] | Group)[]
    'ignore-case': boolean
    order: SortOrder
    type: SortType
  }>,
]

export const RULE_NAME = 'sort-classes'

export default createEslintRule<Options, MESSAGE_ID>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce sorted classes',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          type: {
            enum: [
              SortType.alphabetical,
              SortType.natural,
              SortType['line-length'],
            ],
            default: SortType.alphabetical,
            type: 'string',
          },
          'ignore-case': {
            type: 'boolean',
            default: false,
          },
          order: {
            enum: [SortOrder.asc, SortOrder.desc],
            default: SortOrder.asc,
            type: 'string',
          },
          groups: {
            type: 'array',
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unexpectedClassesOrder: 'Expected "{{right}}" to come before "{{left}}"',
    },
  },
  defaultOptions: [
    {
      type: SortType.alphabetical,
      order: SortOrder.asc,
    },
  ],
  create: context => ({
    ClassBody: node => {
      if (node.body.length > 1) {
        let options = complete(context.options.at(0), {
          type: SortType.alphabetical,
          order: SortOrder.asc,
          'ignore-case': false,
          groups: ['property', 'constructor', 'method', 'unknown'],
        })

        let nodes: SortingNode[] = node.body.map(member => {
          let name: string
          let { getGroup, defineGroup } = useGroups(options.groups)

          if (member.type === 'StaticBlock') {
            name = 'static'
          } else if (member.type === 'TSIndexSignature') {
            name = context.sourceCode.text.slice(
              member.range.at(0),
              member.typeAnnotation?.range.at(0) ?? member.range.at(1),
            )
          } else {
            if (member.key.type === 'Identifier') {
              ;({ name } = member.key)
            } else {
              name = context.sourceCode.text.slice(...member.key.range)
            }
          }

          let isPrivate = name.startsWith('_') || name.startsWith('#')

          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              defineGroup('constructor')
            }

            let isPrivateMethod =
              member.accessibility === 'private' || isPrivate

            let isStaticMethod = member.static

            if (isPrivateMethod && isStaticMethod) {
              defineGroup('static-private-method')
            }

            if (isPrivateMethod) {
              defineGroup('private-method')
            }

            if (isStaticMethod) {
              defineGroup('static-method')
            }

            if (member.kind === 'get') {
              defineGroup('get-method')
            }

            if (member.kind === 'set') {
              defineGroup('set-method')
            }

            defineGroup('method')
          } else if (member.type === 'TSIndexSignature') {
            defineGroup('index-signature')
          } else if (member.type === 'PropertyDefinition') {
            if (member.accessibility === 'private' || isPrivate) {
              defineGroup('private-property')
            }

            if (member.static) {
              defineGroup('static-property')
            }

            defineGroup('property')
          }

          return {
            size: rangeToDiff(member.range),
            group: getGroup(),
            node: member,
            name,
          }
        })

        pairwise(nodes, (left, right) => {
          let leftNum = getGroupNumber(options.groups, left)
          let rightNum = getGroupNumber(options.groups, right)

          if (
            left.name !== right.name &&
            (leftNum > rightNum ||
              (leftNum === rightNum &&
                isPositive(compare(left, right, options))))
          ) {
            context.report({
              messageId: 'unexpectedClassesOrder',
              data: {
                left: toSingleLine(left.name),
                right: toSingleLine(right.name),
              },
              node: right.node,
              fix: (fixer: TSESLint.RuleFixer) => {
                let fixes: TSESLint.RuleFix[] = []

                let grouped = nodes.reduce(
                  (
                    accumulator: {
                      [key: string]: SortingNode[]
                    },
                    sortingNode,
                  ) => {
                    let groupNum = getGroupNumber(options.groups, sortingNode)

                    if (!(groupNum in accumulator)) {
                      accumulator[groupNum] = [sortingNode]
                    } else {
                      accumulator[groupNum] = sortNodes(
                        [...accumulator[groupNum], sortingNode],
                        options,
                      )
                    }

                    return accumulator
                  },
                  {},
                )

                let formatted = Object.keys(grouped)
                  .sort((a, b) => Number(a) - Number(b))
                  .reduce(
                    (accumulator: SortingNode[], group: string) => [
                      ...accumulator,
                      ...grouped[group],
                    ],
                    [],
                  )

                for (let i = 0, max = formatted.length; i < max; i++) {
                  fixes.push(
                    fixer.replaceTextRange(
                      getNodeRange(nodes.at(i)!.node, context.sourceCode),
                      context.sourceCode.text.slice(
                        ...getNodeRange(
                          formatted.at(i)!.node,
                          context.sourceCode,
                        ),
                      ),
                    ),
                  )
                }

                return fixes
              },
            })
          }
        })
      }
    },
  }),
})
