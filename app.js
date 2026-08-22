class SmartTradingBot {
    constructor() {
        this.currencies = [];
        this.buyOpportunities = 0;
        this.sellOpportunities = 0;
        this.init();
    }

    async init() {
        await this.fetchCurrencies();
        this.startAutoUpdate();
    }

    async fetchCurrencies() {
        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d,30d'
            );
            const data = await response.json();
            this.currencies = data.map(coin => this.analyzeComprehensive(coin));
            this.updateUI();
            document.getElementById('currencies-container').innerHTML = this.renderTable();
        } catch (error) {
            console.error('خطأ:', error);
            document.getElementById('currencies-container').innerHTML = '<p style="color: #ff4444; text-align: center; padding: 40px;">❌ خطأ في ��حميل البيانات. حاول مرة أخرى...</p>';
        }
    }

    analyzeComprehensive(coin) {
        const change24h = coin.price_change_percentage_24h || 0;
        const change7d = coin.price_change_percentage_7d_in_currency || 0;
        const change30d = coin.price_change_percentage_30d_in_currency || 0;
        const sparklineData = coin.sparkline_in_7d?.price || [];

        const trendScore = this.analyzeTrend(sparklineData, change24h, change7d);
        const momentumScore = this.analyzeMomentum(change24h, change7d, change30d);
        const volatilityScore = this.analyzeVolatility(sparklineData);
        const priceLevel = this.analyzeResistanceSupport(sparklineData);
        const strengthScore = this.calculateStrength(trendScore, momentumScore, priceLevel);
        const recommendation = this.generateRecommendation(trendScore, momentumScore, volatilityScore, strengthScore);
        const priceTarget = this.predictPrice(coin.current_price, sparklineData, recommendation);

        return {
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            currentPrice: coin.current_price,
            change24h,
            change7d,
            change30d,
            trendScore,
            momentumScore,
            volatilityScore,
            strengthScore,
            recommendation,
            priceTarget,
            priceLevel
        };
    }

    analyzeTrend(sparklineData, change24h, change7d) {
        if (sparklineData.length < 2) return 50;
        let trendScore = 50;

        if (change24h > 5) trendScore += 20;
        else if (change24h > 0) trendScore += 10;
        else if (change24h < -5) trendScore -= 20;
        else if (change24h < 0) trendScore -= 10;

        if (change7d > 10) trendScore += 15;
        else if (change7d > 0) trendScore += 5;
        else if (change7d < -10) trendScore -= 15;

        let upDays = 0;
        for (let i = 1; i < sparklineData.length; i++) {
            if (sparklineData[i] > sparklineData[i-1]) upDays++;
        }
        const upPercent = (upDays / (sparklineData.length - 1)) * 100;
        
        if (upPercent > 70) trendScore += 15;
        else if (upPercent < 30) trendScore -= 15;

        return Math.max(0, Math.min(100, trendScore));
    }

    analyzeMomentum(change24h, change7d, change30d) {
        let momentum = 50;

        const accelerating = Math.abs(change24h) > Math.abs(change7d / 7);
        if (accelerating && change24h > 0) momentum += 20;
        if (accelerating && change24h < 0) momentum -= 20;

        if (change24h > 0 && change7d > 0 && change30d > 0) {
            momentum += 25;
        } else if (change24h < 0 && change7d < 0 && change30d < 0) {
            momentum -= 25;
        }

        return Math.max(0, Math.min(100, momentum));
    }

    analyzeVolatility(sparklineData) {
        if (sparklineData.length < 2) return 50;

        const mean = sparklineData.reduce((a, b) => a + b) / sparklineData.length;
        const variance = sparklineData.reduce((a, b) => a + Math.pow(b - mean, 2)) / sparklineData.length;
        const stdDev = Math.sqrt(variance);
        const volatility = (stdDev / mean) * 100;

        if (volatility > 10) return 30;
        if (volatility > 5) return 40;
        if (volatility > 2) return 50;
        return 70;
    }

    analyzeResistanceSupport(sparklineData) {
        const prices = sparklineData;
        const highest = Math.max(...prices);
        const lowest = Math.min(...prices);
        const current = prices[prices.length - 1];

        return {
            resistance: highest,
            support: lowest,
            current: current,
            distanceFromSupport: ((current - lowest) / (highest - lowest)) * 100
        };
    }

    calculateStrength(trend, momentum, priceLevel) {
        let strength = (trend + momentum) / 2;
        
        if (priceLevel.distanceFromSupport < 30) {
            strength += 15;
        } else if (priceLevel.distanceFromSupport > 70) {
            strength -= 15;
        }

        return Math.max(0, Math.min(100, strength));
    }

    generateRecommendation(trend, momentum, volatility, strength) {
        if (trend > 70 && momentum > 70 && strength > 75 && volatility > 40) {
            return { action: 'buy', confidence: 95, emoji: '🟢🚀', text: 'شراء قوي جداً' };
        }

        if (trend > 60 && momentum > 60 && strength > 65) {
            return { action: 'buy', confidence: 85, emoji: '🟢', text: 'شراء' };
        }

        if (trend < 30 && momentum < 30 && strength < 25 && volatility > 40) {
            return { action: 'sell', confidence: 95, emoji: '🔴🔻', text: 'بيع قوي جداً' };
        }

        if (trend < 40 && momentum < 40 && strength < 35) {
            return { action: 'sell', confidence: 85, emoji: '🔴', text: 'بيع' };
        }

        return { action: 'hold', confidence: 70, emoji: '🟡', text: 'انتظر' };
    }

    predictPrice(currentPrice, sparklineData, recommendation) {
        if (sparklineData.length < 2) {
            return { 
                target: currentPrice.toFixed(2), 
                expectedChange: '0.00'
            };
        }

        let upTargets = [];
        let downTargets = [];

        if (recommendation.action === 'buy') {
            upTargets = [
                currentPrice * 1.05,
                currentPrice * 1.10,
                currentPrice * 1.20
            ];
        } else if (recommendation.action === 'sell') {
            downTargets = [
                currentPrice * 0.95,
                currentPrice * 0.90,
                currentPrice * 0.80
            ];
        } else {
            upTargets = [
                currentPrice * 1.02,
                currentPrice * 1.03,
                currentPrice * 1.05
            ];
            downTargets = [
                currentPrice * 0.98,
                currentPrice * 0.97,
                currentPrice * 0.95
            ];
        }

        const mainTarget = recommendation.action === 'buy' 
            ? upTargets[1] 
            : recommendation.action === 'sell' 
            ? downTargets[1]
            : currentPrice;

        return {
            target: mainTarget.toFixed(2),
            expectedChange: (((mainTarget - currentPrice) / currentPrice) * 100).toFixed(2)
        };
    }

    renderTable() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const recommendationFilter = document.getElementById('recommendation-filter').value;
        const strengthFilter = parseInt(document.getElementById('strength-filter').value) || 0;

        let filtered = this.currencies.filter(c => {
            const matchesSearch = !searchTerm || 
                c.name.toLowerCase().includes(searchTerm) ||
                c.symbol.toLowerCase().includes(searchTerm);

            const matchesRecommendation = !recommendationFilter ||
                c.recommendation.action === recommendationFilter;

            const matchesStrength = !strengthFilter ||
                c.strengthScore >= strengthFilter;

            return matchesSearch && matchesRecommendation && matchesStrength;
        });

        const buyCount = filtered.filter(c => c.recommendation.action === 'buy').length;
        const sellCount = filtered.filter(c => c.recommendation.action === 'sell').length;

        document.getElementById('total-currencies').textContent = this.currencies.length;
        document.getElementById('buy-opportunities').textContent = buyCount;
        document.getElementById('sell-opportunities').textContent = sellCount;

        if (filtered.length === 0) {
            return '<p style="color: #a0d8ff; text-align: center; padding: 40px;">لا توجد عملات مطابقة للفلاتر المختارة</p>';
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>العملة</th>
                        <th>السعر الحالي</th>
                        <th>التغير 24س</th>
                        <th>الاتجاه 📈</th>
                        <th>الزخم 💪</th>
                        <th>القوة</th>
                        <th>التوصية</th>
                        <th>السعر المتوقع</th>
                        <th>الربح المتوقع</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filtered.forEach(coin => {
            const changeClass = coin.change24h > 0 ? 'positive' : 'negative';
            const changeSymbol = coin.change24h > 0 ? '📈' : '📉';
            const arrow = coin.change24h > 0 ? '↑' : '↓';

            const trendColor = coin.trendScore > 60 ? '#00ff88' : coin.trendScore > 40 ? '#ffc107' : '#ff4444';
            const momentumColor = coin.momentumScore > 60 ? '#00ff88' : coin.momentumScore > 40 ? '#ffc107' : '#ff4444';
            const strengthColor = coin.strengthScore > 60 ? '#00ff88' : coin.strengthScore > 40 ? '#ffc107' : '#ff4444';

            html += `
                <tr>
                    <td>
                        <strong>${coin.name}</strong>
                        <div style="color: #a0d8ff; font-size: 0.9em;">${coin.symbol}</div>
                    </td>
                    <td>
                        <strong>$${coin.currentPrice.toFixed(4)}</strong>
                    </td>
                    <td>
                        <span class="change ${changeClass}">
                            ${changeSymbol} ${coin.change24h.toFixed(2)}%
                        </span>
                    </td>
                    <td>
                        <div style="color: ${trendColor}; font-weight: bold;">
                            ${coin.trendScore.toFixed(0)}/100
                        </div>
                    </td>
                    <td>
                        <div style="color: ${momentumColor}; font-weight: bold;">
                            ${coin.momentumScore.toFixed(0)}/100
                        </div>
                    </td>
                    <td>
                        <div style="color: ${strengthColor}; font-weight: bold;">
                            💪 ${coin.strengthScore.toFixed(0)}/100
                        </div>
                    </td>
                    <td>
                        <div class="recommendation ${coin.recommendation.action}">
                            ${coin.recommendation.emoji}<br/>
                            ${coin.recommendation.text}
                        </div>
                    </td>
                    <td>
                        <strong style="color: #00ff88;">$${coin.priceTarget.target}</strong>
                        <div style="font-size: 0.85em; color: #a0d8ff;">
                            ${arrow} ${coin.priceTarget.expectedChange}%
                        </div>
                    </td>
                    <td>
                        <div style="color: ${coin.priceTarget.expectedChange > 0 ? '#00ff88' : '#ff4444'}; font-weight: bold;">
                            ${coin.priceTarget.expectedChange > 0 ? '✅' : '❌'}
                            ${coin.priceTarget.expectedChange}%
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    }

    updateUI() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('last-update').textContent = `${hours}:${minutes}`;
    }

    startAutoUpdate() {
        setInterval(() => {
            this.fetchCurrencies();
        }, 30000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const bot = new SmartTradingBot();

    document.getElementById('search-input').addEventListener('input', () => {
        document.getElementById('currencies-container').innerHTML = bot.renderTable();
    });

    document.getElementById('recommendation-filter').addEventListener('change', () => {
        document.getElementById('currencies-container').innerHTML = bot.renderTable();
    });

    document.getElementById('strength-filter').addEventListener('change', () => {
        document.getElementById('currencies-container').innerHTML = bot.renderTable();
    });
});