class TruckyAPI {
    constructor() {
        this.companyId = TRUCKY_CONFIG.companyId;
        this.accessToken = TRUCKY_CONFIG.accessToken;
        this.headers = {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        // ✅ CORREÇÃO: ADICIONAR CACHE
        this.cache = {
            members: { data: null, timestamp: 0 },
            memberStats: new Map(),
            memberJobs: new Map(),
            locations: new Map(),
        };
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    }

    // ✅ CORREÇÃO: GET COMPANY MEMBERS COM CACHE
    async getCompanyMembers(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && 
            this.cache.members.data && 
            now - this.cache.members.timestamp < this.CACHE_TTL) {
            return this.cache.members.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/members`, {
                headers: this.headers
            });
            this.cache.members.data = response.data.members || [];
            this.cache.members.timestamp = now;
            return this.cache.members.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter membros:", error.message);
            return this.cache.members.data || [];
        }
    }

    // ✅ CORREÇÃO: CHECK ALL MEMBERS COM PARALELISMO LIMITADO
    async checkAllMembersActivity(daysThreshold = 30) {
        const members = await this.getCompanyMembers();
        const results = {
            active: [],
            inactive: [],
            warning: [],
            totalMembers: members.length
        };

        // ✅ CORREÇÃO: PROCESSAR EM LOTE COM LIMITE DE CONCORRÊNCIA
        const CONCURRENCY_LIMIT = 5;
        const chunks = [];
        for (let i = 0; i < members.length; i += CONCURRENCY_LIMIT) {
            chunks.push(members.slice(i, i + CONCURRENCY_LIMIT));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(member => this.checkMemberActivity(member.id, daysThreshold))
            );

            for (let i = 0; i < chunk.length; i++) {
                const member = chunk[i];
                const activity = chunkResults[i];

                const memberData = {
                    id: member.id,
                    name: member.name,
                    discordId: member.discord_id,
                    avatar: member.avatar_url,
                    role: member.role?.name || "Membro",
                    ...activity
                };

                if (activity.daysSinceLastJob === Infinity) {
                    results.inactive.push(memberData);
                } else if (activity.daysSinceLastJob > daysThreshold) {
                    results.inactive.push(memberData);
                } else if (activity.daysSinceLastJob > TRUCKY_CONFIG.inatividade.diasAviso) {
                    results.warning.push(memberData);
                } else {
                    results.active.push(memberData);
                }
            }
        }

        return results;
    }

    // ✅ CORREÇÃO: GET MEMBER STATS COM CACHE
    async getMemberStats(memberId, forceRefresh = false) {
        const cacheKey = memberId;
        const now = Date.now();
        const cached = this.cache.memberStats.get(cacheKey);
        
        if (!forceRefresh && cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/stats`, {
                headers: this.headers
            });
            this.cache.memberStats.set(cacheKey, {
                data: response.data,
                timestamp: now
            });
            return response.data;
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter stats do membro:", error.message);
            return cached?.data || null;
        }
    }

    // ✅ CORREÇÃO: GET MEMBER JOBS COM LIMITE
    async getMemberJobs(memberId, period = "month", limit = 50) {
        const cacheKey = `${memberId}_${period}`;
        const now = Date.now();
        const cached = this.cache.memberJobs.get(cacheKey);
        
        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }

        try {
            const response = await axios.get(`${BASE_URL}/company/${this.companyId}/member/${memberId}/jobs`, {
                headers: this.headers,
                params: { period, limit } // ✅ ADICIONAR LIMITE
            });
            this.cache.memberJobs.set(cacheKey, {
                data: response.data.jobs || [],
                timestamp: now
            });
            return response.data.jobs || [];
        } catch (error) {
            console.error("[TruckyAPI] Erro ao obter jobs do membro:", error.message);
            return cached?.data || [];
        }
    }
}
