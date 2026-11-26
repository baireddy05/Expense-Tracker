package com.example.kharch.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.ui.theme.*
import com.example.kharch.util.CurrencyUtils
import kotlin.math.max
import kotlin.math.roundToInt

data class DonutSlice(
    val label: String,
    val value: Double,
    val color: Color
)

@Composable
fun WeeklyCashFlowLineChart(
    labels: List<String>,
    incomeData: List<Double>,
    expenseData: List<Double>,
    isPrivacyMode: Boolean,
    modifier: Modifier = Modifier
) {
    val kc = LocalKharchColors.current
    var selectedIdx by remember { mutableStateOf<Int?>(null) }

    val maxVal = remember(incomeData, expenseData) {
        val m = max(incomeData.maxOrNull() ?: 0.0, expenseData.maxOrNull() ?: 0.0)
        if (m <= 0.0) 100.0 else m * 1.15
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(KharchEmerald))
                Text("Income", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(KharchRose))
                Text("Expense", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            }
            selectedIdx?.let { idx ->
                if (idx in labels.indices) {
                    Spacer(Modifier.weight(1f))
                    val incStr = CurrencyUtils.formatCompactInr(incomeData.getOrElse(idx) { 0.0 }, isPrivacyMode)
                    val expStr = CurrencyUtils.formatCompactInr(expenseData.getOrElse(idx) { 0.0 }, isPrivacyMode)
                    Text(
                        text = "${labels[idx]}: +$incStr / -$expStr",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = kc.textPrimary,
                        maxLines = 1
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))

        Box(modifier = Modifier.fillMaxWidth().height(170.dp)) {
            val gridColor = kc.textMuted.copy(alpha = 0.14f)
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(labels.size) {
                        detectTapGestures { offset ->
                            if (labels.isNotEmpty()) {
                                val step = size.width.toFloat() / max(1, labels.size - 1)
                                val idx = (offset.x / step).roundToInt().coerceIn(0, labels.lastIndex)
                                selectedIdx = if (selectedIdx == idx) null else idx
                            }
                        }
                    }
            ) {
                val padTop = 10.dp.toPx()
                val padBottom = 10.dp.toPx()
                val padSide = 10.dp.toPx()
                val chartW = (size.width - padSide * 2).coerceAtLeast(1f)
                val chartH = (size.height - padTop - padBottom).coerceAtLeast(1f)

                // Horizontal grid lines
                for (i in 0..3) {
                    val y = padTop + chartH * (i / 3f)
                    drawLine(gridColor, Offset(padSide, y), Offset(size.width - padSide, y), strokeWidth = 1.dp.toPx())
                }

                val count = labels.size
                if (count < 2) return@Canvas
                val stepX = chartW / (count - 1).toFloat()

                fun pointFor(i: Int, value: Double): Offset {
                    val x = padSide + i * stepX
                    val ratio = (value / maxVal).toFloat().coerceIn(0f, 1f)
                    val y = padTop + chartH * (1f - ratio)
                    return Offset(x, y)
                }

                fun drawSeries(data: List<Double>, strokeColor: Color) {
                    val pts = (0 until count).map { pointFor(it, data.getOrElse(it) { 0.0 }) }
                    val linePath = Path().apply {
                        moveTo(pts.first().x, pts.first().y)
                        for (i in 1 until pts.size) {
                            val prev = pts[i - 1]
                            val cur = pts[i]
                            val midX = (prev.x + cur.x) / 2f
                            cubicTo(midX, prev.y, midX, cur.y, cur.x, cur.y)
                        }
                    }
                    val fillPath = Path().apply {
                        addPath(linePath)
                        lineTo(pts.last().x, padTop + chartH)
                        lineTo(pts.first().x, padTop + chartH)
                        close()
                    }
                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(strokeColor.copy(alpha = 0.20f), strokeColor.copy(alpha = 0.0f)),
                            startY = padTop,
                            endY = padTop + chartH
                        )
                    )
                    drawPath(
                        path = linePath,
                        color = strokeColor,
                        style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round)
                    )
                    pts.forEachIndexed { idx, p ->
                        val r = if (selectedIdx == idx) 5.dp.toPx() else 3.dp.toPx()
                        drawCircle(color = strokeColor, radius = r, center = p)
                    }
                }

                drawSeries(incomeData, KharchEmerald)
                drawSeries(expenseData, KharchRose)
            }
        }

        Spacer(Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            labels.forEachIndexed { idx, lbl ->
                Text(
                    text = lbl,
                    fontSize = 10.sp,
                    fontWeight = if (selectedIdx == idx) FontWeight.Bold else FontWeight.Normal,
                    color = if (selectedIdx == idx) kc.textPrimary else kc.textMuted
                )
            }
        }
    }
}

@Composable
fun CategoryDonutChart(
    slices: List<DonutSlice>,
    centerLabel: String,
    centerValue: String,
    modifier: Modifier = Modifier,
    isPie: Boolean = false
) {
    val kc = LocalKharchColors.current
    val total = remember(slices) { slices.sumOf { it.value }.coerceAtLeast(0.0) }

    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        if (total <= 0.0) {
            Box(modifier = Modifier.size(180.dp), contentAlignment = Alignment.Center) {
                Text("No data available", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            }
        } else {
            Box(modifier = Modifier.size(185.dp), contentAlignment = Alignment.Center) {
                Canvas(modifier = Modifier.fillMaxSize().padding(10.dp)) {
                    var startAngle = -90f
                    slices.forEach { s ->
                        if (s.value > 0.0) {
                            val sweep = ((s.value / total) * 360.0).toFloat()
                            if (isPie) {
                                drawArc(
                                    color = s.color,
                                    startAngle = startAngle,
                                    sweepAngle = sweep,
                                    useCenter = true
                                )
                            } else {
                                drawArc(
                                    color = s.color,
                                    startAngle = startAngle,
                                    sweepAngle = sweep,
                                    useCenter = false,
                                    style = Stroke(width = 24.dp.toPx(), cap = StrokeCap.Butt)
                                )
                            }
                            startAngle += sweep
                        }
                    }
                }
                if (!isPie) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(centerLabel, fontSize = 10.sp, color = kc.textMuted)
                        Text(
                            text = centerValue,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = kc.textPrimary,
                            maxLines = 1
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                slices.take(6).forEach { s ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Box(Modifier.size(9.dp).clip(CircleShape).background(s.color))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = s.label,
                                style = MaterialTheme.typography.bodySmall,
                                color = kc.textPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        val pct = if (total > 0) ((s.value / total) * 100.0).roundToInt() else 0
                        Text(
                            text = "$pct%",
                            style = MaterialTheme.typography.labelSmall,
                            color = kc.textMuted
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryBarChart(
    items: List<DonutSlice>,
    isPrivacyMode: Boolean,
    modifier: Modifier = Modifier
) {
    val kc = LocalKharchColors.current
    val topItems = remember(items) { items.take(7) }
    val maxVal = remember(topItems) { (topItems.maxOfOrNull { it.value } ?: 0.0).coerceAtLeast(1.0) }

    if (topItems.isEmpty()) {
        Box(modifier = modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
            Text("No expense data available", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
        }
        return
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        topItems.forEach { item ->
            val ratio = (item.value / maxVal).toFloat().coerceIn(0.03f, 1f)
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.label,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = kc.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = CurrencyUtils.formatInr(item.value, isPrivacyMode),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = kc.textPrimary
                    )
                }
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(kc.subtleSurface)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(ratio)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(6.dp))
                            .background(item.color)
                    )
                }
            }
        }
    }
}

@Composable
fun PeriodComparisonBarChart(
    labels: List<String>,
    periodAValues: List<Double>,
    periodBValues: List<Double>,
    periodALabel: String,
    periodBLabel: String,
    isPrivacyMode: Boolean,
    modifier: Modifier = Modifier
) {
    val kc = LocalKharchColors.current
    val maxVal = remember(periodAValues, periodBValues) {
        max(periodAValues.maxOrNull() ?: 0.0, periodBValues.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(KharchBlue))
                Text(periodALabel, style = MaterialTheme.typography.bodySmall, color = kc.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(Color(0xFF94A3B8)))
                Text(periodBLabel, style = MaterialTheme.typography.bodySmall, color = kc.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }

        if (labels.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                Text("No category data for selected periods", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            }
        } else {
            labels.forEachIndexed { idx, name ->
                val aVal = periodAValues.getOrElse(idx) { 0.0 }
                val bVal = periodBValues.getOrElse(idx) { 0.0 }
                val rA = (aVal / maxVal).toFloat().coerceIn(0f, 1f)
                val rB = (bVal / maxVal).toFloat().coerceIn(0f, 1f)
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(name, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = kc.textPrimary)
                        Text(
                            "${CurrencyUtils.formatCompactInr(aVal, isPrivacyMode)} vs ${CurrencyUtils.formatCompactInr(bVal, isPrivacyMode)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = kc.textMuted
                        )
                    }
                    Canvas(modifier = Modifier.fillMaxWidth().height(16.dp)) {
                        drawRoundRect(
                            color = KharchBlue,
                            topLeft = Offset.Zero,
                            size = Size(size.width * rA, 6.dp.toPx()),
                            cornerRadius = CornerRadius(4.dp.toPx())
                        )
                        drawRoundRect(
                            color = Color(0xFF94A3B8),
                            topLeft = Offset(0f, 9.dp.toPx()),
                            size = Size(size.width * rB, 6.dp.toPx()),
                            cornerRadius = CornerRadius(4.dp.toPx())
                        )
                    }
                }
            }
        }
    }
}
