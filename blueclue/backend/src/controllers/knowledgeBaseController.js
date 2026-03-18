import pool from '../config/database.js';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';

// ============================================================================
// ARTICLE CRUD OPERATIONS
// ============================================================================

/**
 * Get all articles (with filtering for management dashboard)
 */
const getAllArticles = async (req, res) => {
    const { 
        published, 
        category, 
        search, 
        sort = 'created_at', 
        order = 'DESC',
        limit = 50,
        offset = 0
    } = req.query;

    let query = `
        SELECT 
            a.*,
            u.first_name || ' ' || u.last_name as author_name,
            u.email as author_email,
            CASE 
                WHEN a.helpful_votes + a.not_helpful_votes = 0 THEN 0
                ELSE ROUND(a.helpful_votes::numeric / (a.helpful_votes + a.not_helpful_votes) * 100, 1)
            END as helpfulness_percentage,
            (SELECT COUNT(*) FROM article_versions WHERE article_id = a.id) as version_count
        FROM knowledge_articles a
        JOIN users u ON a.created_by = u.id
        WHERE a.deleted_at IS NULL
    `;

    const params = [];
    let paramCount = 1;

    if (published !== undefined) {
        query += ` AND a.is_published = $${paramCount}::boolean`;
        params.push(published === 'true' || published === true);
        paramCount++;
    }

    if (category) {
        query += ` AND a.category = $${paramCount}`;
        params.push(category);
        paramCount++;
    }

    if (search) {
        query += ` AND (a.title ILIKE $${paramCount} OR a.content ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    // Validate sort column to prevent SQL injection
    const allowedSorts = ['created_at', 'updated_at', 'title', 'views', 'helpful_votes', 'published_at'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY a.${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM knowledge_articles WHERE deleted_at IS NULL';
    const countParams = [];
    let countParamNum = 1;

    if (published !== undefined) {
        countQuery += ` AND is_published = $${countParamNum}::boolean`;
        countParams.push(published === 'true' || published === true);
        countParamNum++;
    }

    if (category) {
        countQuery += ` AND category = $${countParamNum}`;
        countParams.push(category);
        countParamNum++;
    }

    if (search) {
        countQuery += ` AND (title ILIKE $${countParamNum} OR content ILIKE $${countParamNum})`;
        countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
        articles: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
};

/**
 * Get single article by ID
 */
const getArticleById = async (req, res) => {
    const { id } = req.params;

    const result = await pool.query(`
        SELECT 
            a.*,
            u.first_name || ' ' || u.last_name as author_name,
            u.email as author_email,
            uu.first_name || ' ' || uu.last_name as updated_by_name,
            CASE 
                WHEN a.helpful_votes + a.not_helpful_votes = 0 THEN 0
                ELSE ROUND(a.helpful_votes::numeric / (a.helpful_votes + a.not_helpful_votes) * 100, 1)
            END as helpfulness_percentage
        FROM knowledge_articles a
        JOIN users u ON a.created_by = u.id
        LEFT JOIN users uu ON a.updated_by = uu.id
        WHERE a.id = $1::integer AND a.deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
    }

    res.json(result.rows[0]);
};

/**
 * Create new article
 */
const createArticle = async (req, res) => {
    const {
        title,
        content,
        category,
        tags = [],
        difficulty = 'beginner',
        is_public = true,
        is_published = false,
        excerpt,
        meta_description
    } = req.body;

    const userId = req.user.id;

    // Generate slug from title
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    try {
        const result = await pool.query(`
            INSERT INTO knowledge_articles (
                title, content, category, tags, difficulty,
                is_public, is_published, excerpt, meta_description,
                slug, created_by, updated_by
            ) VALUES (
                $1, $2, $3, $4::jsonb, $5::article_difficulty,
                $6::boolean, $7::boolean, $8, $9,
                $10, $11::integer, $11::integer
            ) RETURNING *
        `, [
            title, content, category, JSON.stringify(tags), difficulty,
            is_public, is_published, excerpt, meta_description,
            slug, userId
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'knowledge_articles_slug_key') {
            throw new ConflictError('An article with a similar title already exists');
        }
        throw error;
    }
};

/**
 * Update existing article
 */
const updateArticle = async (req, res) => {
    const { id } = req.params;
    const {
        title,
        content,
        category,
        tags,
        difficulty,
        is_public,
        is_published,
        excerpt,
        meta_description
    } = req.body;

    const userId = req.user.id;

    // Generate new slug if title changed
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    try {
        const result = await pool.query(`
            UPDATE knowledge_articles
            SET 
                title = COALESCE($1, title),
                content = COALESCE($2, content),
                category = COALESCE($3, category),
                tags = COALESCE($4::jsonb, tags),
                difficulty = COALESCE($5::article_difficulty, difficulty),
                is_public = COALESCE($6::boolean, is_public),
                is_published = COALESCE($7::boolean, is_published),
                excerpt = COALESCE($8, excerpt),
                meta_description = COALESCE($9, meta_description),
                slug = COALESCE($10, slug),
                updated_by = $11::integer,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12::integer AND deleted_at IS NULL
            RETURNING *
        `, [
            title, content, category, tags ? JSON.stringify(tags) : null, difficulty,
            is_public, is_published, excerpt, meta_description,
            slug, userId, id
        ]);

        if (result.rows.length === 0) {
            throw new NotFoundError('Article not found');
        }

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505' && error.constraint === 'knowledge_articles_slug_key') {
            throw new ConflictError('An article with a similar title already exists');
        }
        throw error;
    }
};

/**
 * Soft delete article
 */
const deleteArticle = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
        UPDATE knowledge_articles
        SET 
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $1::integer
        WHERE id = $2::integer AND deleted_at IS NULL
        RETURNING id, title
    `, [userId, id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
    }

    res.json({ message: 'Article deleted successfully', article: result.rows[0] });
};

/**
 * Publish/unpublish article
 */
const togglePublishArticle = async (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;
    const userId = req.user.id;

    const result = await pool.query(`
        UPDATE knowledge_articles
        SET 
            is_published = $1::boolean,
            updated_by = $2::integer,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3::integer AND deleted_at IS NULL
        RETURNING *
    `, [is_published, userId, id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
    }

    res.json(result.rows[0]);
};

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================

/**
 * Get all categories
 */
const getCategories = async (req, res) => {
    const result = await pool.query(`
        SELECT 
            c.*,
            COUNT(a.id) as article_count
        FROM knowledge_categories c
        LEFT JOIN knowledge_articles a ON a.category = c.name AND a.deleted_at IS NULL
        WHERE c.is_active = true
        GROUP BY c.id
        ORDER BY c.sort_order, c.name
    `);

    res.json(result.rows);
};

/**
 * Create new category
 */
const createCategory = async (req, res) => {
    const { name, display_name, description, icon, sort_order = 0 } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO knowledge_categories (name, display_name, description, icon, sort_order)
            VALUES ($1, $2, $3, $4, $5::integer)
            RETURNING *
        `, [name, display_name, description, icon, sort_order]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            throw new ConflictError('Category already exists');
        }
        throw error;
    }
};

/**
 * Update category
 */
const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { display_name, description, icon, sort_order, is_active } = req.body;

    const result = await pool.query(`
        UPDATE knowledge_categories
        SET 
            display_name = COALESCE($1, display_name),
            description = COALESCE($2, description),
            icon = COALESCE($3, icon),
            sort_order = COALESCE($4::integer, sort_order),
            is_active = COALESCE($5::boolean, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6::integer
        RETURNING *
    `, [display_name, description, icon, sort_order, is_active, id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Category not found');
    }

    res.json(result.rows[0]);
};

/**
 * Delete category (deactivate)
 */
const deleteCategory = async (req, res) => {
    const { id } = req.params;

    // Check if category has articles
    const checkResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM knowledge_articles
        WHERE category = (SELECT name FROM knowledge_categories WHERE id = $1::integer)
          AND deleted_at IS NULL
    `, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
        throw new BadRequestError('Cannot delete category with existing articles', {
            article_count: parseInt(checkResult.rows[0].count)
        });
    }

    const result = await pool.query(`
        UPDATE knowledge_categories
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::integer
        RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Category not found');
    }

    res.json({ message: 'Category deactivated successfully', category: result.rows[0] });
};

// ============================================================================
// TAG MANAGEMENT
// ============================================================================

/**
 * Get all unique tags from articles
 */
const getAllTags = async (req, res) => {
    const result = await pool.query(`
        SELECT DISTINCT jsonb_array_elements_text(tags) as tag, COUNT(*) as usage_count
        FROM knowledge_articles
        WHERE deleted_at IS NULL AND tags IS NOT NULL
        GROUP BY tag
        ORDER BY usage_count DESC, tag
    `);

    res.json(result.rows);
};

/**
 * Bulk update tags for multiple articles
 */
const bulkUpdateTags = async (req, res) => {
    const { article_ids, tags_to_add = [], tags_to_remove = [] } = req.body;
    const userId = req.user.id;

    if (!article_ids || !Array.isArray(article_ids) || article_ids.length === 0) {
        throw new BadRequestError('article_ids array is required');
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        for (const articleId of article_ids) {
            // Get current tags
            const currentResult = await client.query(
                'SELECT tags FROM knowledge_articles WHERE id = $1::integer AND deleted_at IS NULL',
                [articleId]
            );

            if (currentResult.rows.length === 0) continue;

            let currentTags = currentResult.rows[0].tags || [];
            
            // Remove tags
            if (tags_to_remove.length > 0) {
                currentTags = currentTags.filter(tag => !tags_to_remove.includes(tag));
            }

            // Add tags (avoid duplicates)
            if (tags_to_add.length > 0) {
                tags_to_add.forEach(tag => {
                    if (!currentTags.includes(tag)) {
                        currentTags.push(tag);
                    }
                });
            }

            // Update article
            await client.query(`
                UPDATE knowledge_articles
                SET tags = $1::jsonb, updated_by = $2::integer, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3::integer
            `, [JSON.stringify(currentTags), userId, articleId]);
        }

        res.json({ message: 'Tags updated successfully', updated_count: article_ids.length });
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// ============================================================================
// VERSION CONTROL
// ============================================================================

/**
 * Get version history for an article
 */
const getArticleVersions = async (req, res) => {
    const { id } = req.params;

    const result = await pool.query(`
        SELECT * FROM article_version_history
        WHERE article_id = $1::integer
        ORDER BY version_number DESC
    `, [id]);

    res.json(result.rows);
};

/**
 * Get specific version details
 */
const getVersionById = async (req, res) => {
    const { id, versionNumber } = req.params;

    const result = await pool.query(`
        SELECT 
            av.*,
            u.first_name || ' ' || u.last_name as edited_by_name
        FROM article_versions av
        JOIN users u ON av.edited_by = u.id
        WHERE av.article_id = $1::integer AND av.version_number = $2::integer
    `, [id, versionNumber]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Version not found');
    }

    res.json(result.rows[0]);
};

/**
 * Restore article to a previous version
 */
const restoreVersion = async (req, res) => {
    const { id, versionNumber } = req.params;
    const userId = req.user.id;

    await pool.query('SELECT restore_article_version($1::integer, $2::integer, $3::integer)', 
        [id, versionNumber, userId]
    );

    // Fetch the restored article
    const result = await pool.query(
        'SELECT * FROM knowledge_articles WHERE id = $1::integer',
        [id]
    );

    res.json({ 
        message: 'Article restored successfully', 
        article: result.rows[0] 
    });
};

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get analytics dashboard data
 */
const getAnalytics = async (req, res) => {
    // Get overall stats
    const statsResult = await pool.query('SELECT * FROM kb_management_stats');
    
    // Get most viewed articles
    const mostViewedResult = await pool.query(`
        SELECT id, title, category, views, helpful_votes, not_helpful_votes,
               CASE 
                   WHEN helpful_votes + not_helpful_votes = 0 THEN 0
                   ELSE ROUND(helpful_votes::numeric / (helpful_votes + not_helpful_votes) * 100, 1)
               END as helpfulness_percentage
        FROM knowledge_articles
        WHERE deleted_at IS NULL AND is_published = true
        ORDER BY views DESC
        LIMIT 10
    `);

    // Get least viewed articles (published but low engagement)
    const leastViewedResult = await pool.query(`
        SELECT id, title, category, views, published_at
        FROM knowledge_articles
        WHERE deleted_at IS NULL AND is_published = true
        ORDER BY views ASC, published_at DESC
        LIMIT 10
    `);

    // Get articles by category with stats
    const categoryStatsResult = await pool.query(`
        SELECT 
            category,
            COUNT(*) as article_count,
            SUM(views) as total_views,
            AVG(views) as avg_views,
            SUM(helpful_votes) as total_helpful,
            SUM(not_helpful_votes) as total_not_helpful
        FROM knowledge_articles
        WHERE deleted_at IS NULL AND is_published = true
        GROUP BY category
        ORDER BY article_count DESC
    `);

    res.json({
        overview: statsResult.rows[0],
        most_viewed: mostViewedResult.rows,
        least_viewed: leastViewedResult.rows,
        by_category: categoryStatsResult.rows
    });
};

/**
 * Increment article view count
 */
const incrementViewCount = async (req, res) => {
    const { id } = req.params;

    await pool.query(`
        UPDATE knowledge_articles
        SET views = views + 1
        WHERE id = $1::integer AND deleted_at IS NULL
    `, [id]);

    res.json({ message: 'View count incremented' });
};

/**
 * Get a single public article by ID (no authentication required)
 * GET /api/knowledge-base/public/articles/:id
 */
const getPublicArticle = async (req, res) => {
    const { id } = req.params;

    const result = await pool.query(`
        SELECT 
            a.id,
            a.title,
            a.slug,
            a.content,
            a.category,
            a.tags,
            a.difficulty,
            a.excerpt,
            a.views,
            a.helpful_votes,
            a.not_helpful_votes,
            a.published_at,
            a.created_at,
            a.updated_at,
            u.first_name || ' ' || u.last_name as author_name,
            CASE 
                WHEN a.helpful_votes + a.not_helpful_votes = 0 THEN 0
                ELSE ROUND(a.helpful_votes::numeric / (a.helpful_votes + a.not_helpful_votes) * 100, 1)
            END as helpfulness_percentage
        FROM knowledge_articles a
        JOIN users u ON a.created_by = u.id
        WHERE a.id = $1::integer 
            AND a.deleted_at IS NULL
            AND a.is_published = true
            AND a.is_public = true
    `, [id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
    }

    res.json(result.rows[0]);
};

/**
 * Search articles with full-text search and filters
 * GET /api/knowledge-base/search?q=query&category=&tags=&difficulty=&sort=relevance&limit=20&offset=0
 */
const searchArticles = async (req, res) => {
    const {
        q = '',
        category,
        tags,
        difficulty,
        sort = 'relevance',
        limit = 20,
        offset = 0
    } = req.query;

    const params = [];
    let paramCount = 1;

    // Base query with full-text search ranking
    let query = `
        SELECT 
            a.id,
            a.title,
            a.slug,
            a.category,
            a.tags,
            a.difficulty,
            a.excerpt,
            a.views,
            a.helpful_votes,
            a.not_helpful_votes,
            a.published_at,
            a.created_at,
            a.updated_at,
            u.first_name || ' ' || u.last_name as author_name,
            CASE 
                WHEN a.helpful_votes + a.not_helpful_votes = 0 THEN 0
                ELSE ROUND(a.helpful_votes::numeric / (a.helpful_votes + a.not_helpful_votes) * 100, 1)
            END as helpfulness_percentage,
            -- Highlighted snippet from content (first 300 chars)
            LEFT(a.content, 300) as snippet
    `;

    // Add relevance ranking if there's a search query
    if (q && q.trim() !== '') {
        query += `,
            ts_rank_cd(
                a.search_vector, 
                plainto_tsquery('english', $${paramCount}),
                32 /* rank with cover density */
            ) + (a.helpful_votes * 0.01) as relevance_score
        `;
        params.push(q.trim());
        paramCount++;
    } else {
        query += `, 0 as relevance_score `;
    }

    query += `
        FROM knowledge_articles a
        JOIN users u ON a.created_by = u.id
        WHERE a.deleted_at IS NULL 
            AND a.is_published = true
            AND a.is_public = true
    `;

    // Add full-text search filter
    if (q && q.trim() !== '') {
        query += ` AND a.search_vector @@ plainto_tsquery('english', $${paramCount - 1})`;
    }

    // Add category filter
    if (category) {
        query += ` AND a.category = $${paramCount}`;
        params.push(category);
        paramCount++;
    }

    // Add difficulty filter
    if (difficulty) {
        query += ` AND a.difficulty = $${paramCount}`;
        params.push(difficulty);
        paramCount++;
    }

    // Add tags filter (check if any tag matches)
    if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query += ` AND a.tags ?| $${paramCount}::text[]`;
        params.push(tagArray);
        paramCount++;
    }

    // Add sorting
    const allowedSorts = {
        'relevance': 'relevance_score DESC, a.helpful_votes DESC',
        'date': 'a.published_at DESC',
        'popularity': 'a.views DESC',
        'helpful': 'a.helpful_votes DESC',
        'recent': 'a.created_at DESC'
    };
    const sortClause = allowedSorts[sort] || allowedSorts['relevance'];
    query += ` ORDER BY ${sortClause}`;

    // Add pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
        SELECT COUNT(*) 
        FROM knowledge_articles a
        WHERE a.deleted_at IS NULL 
            AND a.is_published = true
            AND a.is_public = true
    `;
    const countParams = [];
    let countParamNum = 1;

    if (q && q.trim() !== '') {
        countQuery += ` AND a.search_vector @@ plainto_tsquery('english', $${countParamNum})`;
        countParams.push(q.trim());
        countParamNum++;
    }

    if (category) {
        countQuery += ` AND a.category = $${countParamNum}`;
        countParams.push(category);
        countParamNum++;
    }

    if (difficulty) {
        countQuery += ` AND a.difficulty = $${countParamNum}`;
        countParams.push(difficulty);
        countParamNum++;
    }

    if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        countQuery += ` AND a.tags ?| $${countParamNum}::text[]`;
        countParams.push(tagArray);
    }

    const countResult = await pool.query(countQuery, countParams);

        res.json({
            results: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].count)
        });
};

/**
 * Get autocomplete suggestions for search
 * GET /api/knowledge-base/search/autocomplete?q=query
 */
const getSearchSuggestions = async (req, res) => {
    const { q = '' } = req.query;

    if (!q || q.trim().length < 2) {
        return res.json({ suggestions: [] });
    }

    const result = await pool.query(`
        SELECT 
            id,
            title,
            slug,
            category,
            ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank
        FROM knowledge_articles
        WHERE deleted_at IS NULL 
            AND is_published = true
            AND is_public = true
            AND search_vector @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC, views DESC
        LIMIT 5
    `, [q.trim()]);

    res.json({
        suggestions: result.rows.map(row => ({
            id: row.id,
            title: row.title,
            slug: row.slug,
            category: row.category
        }))
    });
};

/**
 * Get related articles based on tags and category
 * GET /api/knowledge-base/articles/:id/related
 */
const getRelatedArticles = async (req, res) => {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    // First, get the current article's tags and category
    const articleResult = await pool.query(`
        SELECT id, category, tags
        FROM knowledge_articles
        WHERE id = $1::integer AND deleted_at IS NULL
    `, [id]);

    if (articleResult.rows.length === 0) {
        throw new NotFoundError('Article not found');
    }

    const article = articleResult.rows[0];

    // Find related articles based on:
    // 1. Same category (weight: 3)
    // 2. Shared tags (weight: 2 per tag)
    // 3. Views and helpfulness (weight: 1)
    const result = await pool.query(`
            WITH article_tags AS (
                SELECT jsonb_array_elements_text($2) as tag
            )
            SELECT 
                a.id,
                a.title,
                a.slug,
                a.category,
                a.tags,
                a.difficulty,
                a.excerpt,
                a.views,
                a.helpful_votes,
                -- Calculate relevance score
                (
                    CASE WHEN a.category = $3 THEN 3 ELSE 0 END +
                    (
                        SELECT COUNT(*) * 2 
                        FROM article_tags at
                        WHERE a.tags ? at.tag
                    ) +
                    (a.helpful_votes * 0.01) +
                    (a.views * 0.001)
                ) as relevance_score
            FROM knowledge_articles a
            WHERE a.id != $1::integer
                AND a.deleted_at IS NULL
                AND a.is_published = true
                AND a.is_public = true
                AND (
                    a.category = $3
                    OR EXISTS (
                        SELECT 1 FROM article_tags at
                        WHERE a.tags ? at.tag
                    )
                )
            ORDER BY relevance_score DESC, a.views DESC
            LIMIT $4
        `, [id, JSON.stringify(article.tags || []), article.category, parseInt(limit)]);

    res.json({
        related: result.rows
    });
};

/**
 * Submit feedback/vote for an article
 * POST /api/knowledge-base/articles/:id/feedback
 * Body: { wasHelpful: boolean, feedback?: string }
 */
const submitFeedback = async (req, res) => {
    const { id } = req.params;
    const { wasHelpful, feedback } = req.body;
    const userId = req.user?.id || null; // Optional - allow anonymous feedback

    if (typeof wasHelpful !== 'boolean') {
        throw new BadRequestError('wasHelpful must be a boolean');
    }

    try {
        // Insert feedback (trigger will automatically update article vote counts)
        const query = `
            INSERT INTO article_feedback (article_id, user_id, was_helpful, feedback)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (article_id, user_id) 
            DO UPDATE SET 
                was_helpful = EXCLUDED.was_helpful,
                feedback = EXCLUDED.feedback,
                created_at = CURRENT_TIMESTAMP
            RETURNING id, was_helpful, feedback, created_at
        `;

        const result = await pool.query(query, [id, userId, wasHelpful, feedback || null]);

        res.json({
            message: 'Feedback submitted successfully',
            feedback: result.rows[0]
        });
    } catch (error) {
        // Handle unique constraint violation for anonymous users
        if (error.code === '23505') {
            throw new ConflictError('You have already submitted feedback for this article');
        }
        throw error;
    }
};

export {
    // Article CRUD
    getAllArticles,
    getArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    togglePublishArticle,
    
    // Category management
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    
    // Tag management
    getAllTags,
    bulkUpdateTags,
    
    // Version control
    getArticleVersions,
    getVersionById,
    restoreVersion,
    
    // Analytics
    getAnalytics,
    incrementViewCount,
    submitFeedback,
    
    // Search functionality
    searchArticles,
    getSearchSuggestions,
    getRelatedArticles,
    getPublicArticle
};
