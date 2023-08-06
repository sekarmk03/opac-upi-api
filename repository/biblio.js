const { biblio: Biblio, sequelize, material_type_dm: Material, collection_dm: Collection, biblio_copy: BibCopy, biblio_status_dm: BibStatus, biblio_field: BibDetail } = require('../models');
const { Op, QueryTypes } = require('sequelize');
const reducePub = require('../utils/reducePub');
const removeDuplicate = require('../utils/removeDuplicate');
const generateCondition = require('../utils/generateCondition');

module.exports = {
    basicSearchRepo: async (search, key, sort, type, limit, start) => {
        const biblios = await Biblio.findAndCountAll({
            where: {
                [search]: {
                    [Op.like]: sequelize.fn('LOWER', sequelize.col(`${search}`)),
                    [Op.like]: `%${key.toLowerCase()}%`
                }
            },
            include: [
                {
                    model: Collection,
                    as: 'collection',
                    attributes: ['description']
                },
                {
                    model: Material,
                    as: 'material',
                    attributes: ['description']
                },
                {
                    model: BibCopy,
                    as: 'copies',
                    attributes: ['status_cd'],
                }
            ],
            order: [
                [sort, type]
            ],
            limit: limit,
            offset: start,
            distinct: true,
        });

        return biblios;
    },

    subjectSearch: async (search, key, sort, type, limit, start) => {
        const biblios = await Biblio.findAndCountAll({
            where: {
                [Op.or]: [
                    {
                        topic1: {
                            [Op.like]: sequelize.fn('LOWER', sequelize.col('topic1')),
                            [Op.like]: `%${key.toLowerCase()}%`
                        }
                    },
                    {
                        topic2: {
                            [Op.like]: sequelize.fn('LOWER', sequelize.col('topic2')),
                            [Op.like]: `%${key.toLowerCase()}%`
                        }
                    },
                    {
                        topic3: {
                            [Op.like]: sequelize.fn('LOWER', sequelize.col('topic3')),
                            [Op.like]: `%${key.toLowerCase()}%`
                        }
                    },
                    {
                        topic4: {
                            [Op.like]: sequelize.fn('LOWER', sequelize.col('topic4')),
                            [Op.like]: `%${key.toLowerCase()}%`
                        }
                    },
                    {
                        topic5: {
                            [Op.like]: sequelize.fn('LOWER', sequelize.col('topic5')),
                            [Op.like]: `%${key.toLowerCase()}%`
                        }
                    },
                ]
            },
            include: [
                {
                    model: Collection,
                    as: 'collection',
                    attributes: ['description']
                },
                {
                    model: Material,
                    as: 'material',
                    attributes: ['description']
                },
                {
                    model: BibCopy,
                    as: 'copies',
                    attributes: ['status_cd'],
                }
            ],
            order: [
                [sort, type]
            ],
            limit: limit,
            offset: start,
            distinct: true
        });

        return biblios;
    },

    findById: async (id) => {
        const biblio = await Biblio.findOne({
            where: {
                bibid: id,
            },
            include: [
                {
                    model: Collection,
                    as: 'collection',
                    attributes: ['description']
                },
                {
                    model: Material,
                    as: 'material',
                    attributes: ['description']
                },
                {
                    model: BibCopy,
                    as: 'copies',
                    attributes: ['copyid', 'barcode_nmbr', 'status_cd', 'status_begin_dt', 'due_back_dt'],
                    include: {
                        model: BibStatus,
                        as: 'status',
                        attributes: ['description']
                    }
                }
            ],
        });

        return biblio;
    },

    findDetailById: async (id) => {
        const biblioDetail = await BibDetail.findAll({
            where: {bibid: id},
            attributes: ['tag', 'subfield_cd', 'field_data']
        });

        return biblioDetail;
    },

    simpleBasicSearch: async (search, key) => {
        let query = `SELECT b.bibid, b.title, b.author, f.tag, f.subfield_cd, f.field_data FROM biblio AS b LEFT JOIN (SELECT * FROM biblio_field WHERE (tag=260 AND subfield_cd='b') OR (tag=260 AND subfield_cd='c')) as f ON b.bibid = f.bibid WHERE LOWER(b.${search}) LIKE '%${key}%'`;

        const biblios = await sequelize.query(query, { type: QueryTypes.SELECT });

        const finBiblios = reducePub(biblios);

        return finBiblios;
    },

    simpleSubjectSearch: async (key1, key2, key3) => {
        // let query = `SELECT subq.bibid, subq.title, subq.author, subq.tag, subq.subfield_cd, subq.field_data
        // FROM (
        //     SELECT b.bibid, b.title, b.author, f.tag, f.subfield_cd, f.field_data
        //     FROM biblio AS b
        //     LEFT JOIN (
        //         SELECT * FROM biblio_field
        //         WHERE (tag=260 AND subfield_cd='b') OR (tag=260 AND subfield_cd='c')
        //     ) AS f ON b.bibid = f.bibid
        //     WHERE LOWER(b.topic1) LIKE '%${key1}%'
        //         OR LOWER(b.topic2) LIKE '%${key1}%'
        //         OR LOWER(b.topic1) LIKE '%${key2}%'
        //         OR LOWER(b.topic2) LIKE '%${key2}%'
        //         OR LOWER(b.topic1) LIKE '%${key3}%'
        //         OR LOWER(b.topic2) LIKE '%${key3}%'
        // ) AS subq
        // GROUP BY subq.title;`;
        let query = `
            SELECT b.bibid, b.title, b.author, f.tag, f.subfield_cd, f.field_data
            FROM biblio AS b
            LEFT JOIN (
                SELECT * FROM biblio_field
                WHERE (tag=260 AND subfield_cd='b') OR (tag=260 AND subfield_cd='c')
            ) AS f ON b.bibid = f.bibid
            WHERE LOWER(b.topic1) LIKE '%${key1}%'
                OR LOWER(b.topic2) LIKE '%${key1}%'
                OR LOWER(b.topic1) LIKE '%${key2}%'
                OR LOWER(b.topic2) LIKE '%${key2}%'
                OR LOWER(b.topic1) LIKE '%${key3}%'
                OR LOWER(b.topic2) LIKE '%${key3}%'
        ;`;

        const biblios = await sequelize.query(query, { type: QueryTypes.SELECT });

        const redBiblios = reducePub(biblios);

        const finBiblios = removeDuplicate(redBiblios);

        return finBiblios;
    },

    advanceSearch: async (sort, type, limit, start, title, author, subject, material, collection, publisher, year) => {
        const conditions = [];
        const incConditons = [];

        if (title && title.length > 0) generateCondition(conditions, title, 'title');
        if (author && author.length > 0) generateCondition(conditions, author, 'author');
        if (subject && subject.length > 0) generateCondition(conditions, subject, 'subject');
        if (publisher && publisher.length > 0) generateCondition(incConditons, publisher, 'publisher');
        if (year && year.length > 0) generateCondition(incConditons, year, 'year');

        if (material != null || material !== '' || material) {
            const materialCond = { material_cd: material };
            conditions.push(materialCond);
        }

        if (collection != null || collection !== '' || collection) {
            const collectionCond = { collection_cd: collection };
            conditions.push(collectionCond);
        }

        const whereCondition = {
            [Op.and]: conditions,
        };

        const whereIncCondition = {
            [Op.or]: incConditons,
        };

        const biblios = await Biblio.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: Collection,
                    as: 'collection',
                    attributes: ['description']
                },
                {
                    model: Material,
                    as: 'material',
                    attributes: ['description']
                },
                {
                    model: BibCopy,
                    as: 'copies',
                    attributes: ['status_cd'],
                },
                {
                    model: BibDetail,
                    as: 'detail',
                    attributes: ['tag', 'subfield_cd', 'field_data'],
                    where: whereIncCondition
                }
            ],
            order: [
                [sort, type]
            ],
            limit: limit,
            offset: start,
            distinct: true
        });

        // const result = biblios.rows.map(async data => {
        //     const res = await BibDetail.findAll({
        //         where: {
        //             bibid: data.bibid,
        //             ...whereIncCondition
        //         }
        //     });

        //     return {
        //         ...data,
        //         detail: res
        //     }
        // });

        // return {
        //     count: biblios.count,
        //     rows: result
        // };

        return biblios;
    }
}